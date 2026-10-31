import Link from "next/link";
import { notFound } from "next/navigation";
import { AttemptClock } from "@/components/academic/attempt-clock";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { canReadGrade, canStartAttempt } from "@/server/academic/rules";
import { addQuestionAction, gradeEssayAction, loadQuiz, publishQuizAction, releaseQuizAction, startQuizAction, submitQuizAction } from "@/server/academic/actions";
import { optInReviewAction, reviewForQuiz } from "@/server/campus-loop/actions";

export const metadata = { title: "Quiz" };

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { courseId, quizId } = await params;
  const loaded = await loadQuiz(courseId, quizId);
  if (!loaded) {
    notFound();
  }
  const { quiz, isStaff, viewerId, revealAnswers } = loaded;
  const mine = quiz.attempts.filter((attempt) => attempt.studentId === viewerId);
  const open = mine.find((attempt) => attempt.status === "IN_PROGRESS");
  const start = canStartAttempt({
    published: quiz.published,
    now: new Date(),
    openAt: quiz.openAt,
    closeAt: quiz.closeAt,
    attemptCount: mine.filter((attempt) => attempt.status === "SUBMITTED").length,
    attemptLimit: quiz.attemptLimit,
    hasOpenAttempt: Boolean(open),
  });
  const review = isStaff ? null : await reviewForQuiz(quiz.id);
  const questions = quiz.shuffleQuestions && open
    ? [...quiz.questions].sort((left, right) => (open.id + left.id).localeCompare(open.id + right.id))
    : quiz.questions;

  return (
    <div className="grid gap-6">
      <div>
        <Link className="text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>
          Back to course
        </Link>
        <h1 className="mt-2 font-display text-4xl">{quiz.title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{quiz.instructions}</p>
        <p className="mt-2 text-sm text-ink-soft">
          {open
            ? `In progress · ${questions.length} question${questions.length === 1 ? "" : "s"}. Submit sends this attempt to the server.`
            : start.ok
              ? mine.some((attempt) => attempt.status === "SUBMITTED")
                ? `An attempt is on record. ${quiz.attemptLimit - mine.filter((attempt) => attempt.status === "SUBMITTED").length} attempt${quiz.attemptLimit - mine.filter((attempt) => attempt.status === "SUBMITTED").length === 1 ? "" : "s"} left.`
                : "No attempt yet. Start when you are ready to answer."
              : start.reason}{" "}
          {quiz.timeLimitMinutes ? ` Time limit ${quiz.timeLimitMinutes} minutes.` : ""}
          {" "}
          A browser quiz records a server-side score. It cannot stop someone from looking up an answer.
        </p>
      </div>
      {!isStaff && start.ok ? (
        <form action={startQuizAction}>
          <input type="hidden" name="quizId" value={quiz.id} />
          <Button type="submit">Start attempt</Button>
        </form>
      ) : null}
      {open ? (
        <form action={submitQuizAction} className="grid gap-4">
          <input type="hidden" name="attemptId" value={open.id} />
          {quiz.timeLimitMinutes ? <AttemptClock startedAt={open.startedAt.toISOString()} limitMinutes={quiz.timeLimitMinutes} /> : null}
          {questions.map((question, index) => (
            <Card key={question.id}>
              <CardTitle>
                {index + 1}. {question.prompt}
              </CardTitle>
              <CardText>{question.points} points</CardText>
              <div className="mt-3 grid gap-2">
                {question.type === "SHORT" || question.type === "NUMERICAL" || question.type === "ESSAY" ? (
                  <Textarea name={`text_${question.id}`} aria-label={question.prompt} required={question.type !== "ESSAY"} />
                ) : (
                  question.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <input type={question.type === "MULTIPLE" ? "checkbox" : "radio"} name={`opt_${question.id}`} value={option.id} />
                      {option.text}
                    </label>
                  ))
                )}
              </div>
            </Card>
          ))}
          <Button type="submit">Submit attempt</Button>
        </form>
      ) : null}
      {mine
        .filter((attempt) => attempt.status === "SUBMITTED")
        .sort((left, right) => (right.submittedAt?.getTime() ?? 0) - (left.submittedAt?.getTime() ?? 0))
        .map((attempt, index) => (
          <Card key={attempt.id}>
            <CardTitle>{index === 0 ? "Your submitted attempt" : "Earlier attempt"}</CardTitle>
            <CardText>
              {canReadGrade({ isStaff: false, isOwner: true, released: quiz.pointsReleased })
                ? `Score ${attempt.score} / ${attempt.maxScore}`
                : "Score hidden until the lecturer releases it."}
              {revealAnswers ? " Correct answers are marked." : ""}
            </CardText>
            {revealAnswers
              ? quiz.questions.map((question) => (
                  <p key={question.id} className="mt-2 text-sm text-ink-soft">
                    {question.prompt}
                    {question.options.filter((option) => option.correct).map((option) => ` · ${option.text}`)}
                    {question.correctText ? ` · ${question.correctText}` : ""}
                  </p>
                ))
              : null}
          </Card>
        ))}
      {review && review.missed.length > 0 ? (
        <Card>
          <CardTitle>Review a missed question</CardTitle>
          <CardText>The score stays on the attempt above. Names appear only after you opt in, and only for people who opted in too.</CardText>
          {review.missed.map((item) => (
            <div key={item.questionId} className="mt-3 text-sm">
              <p>{item.prompt}</p>
              {item.optedIn ? (
                <p className="text-ink-soft">{item.names.length ? item.names.join(", ") : "You are the only person opted in so far."}</p>
              ) : (
                <form action={optInReviewAction} className="mt-2">
                  <input type="hidden" name="quizId" value={quiz.id} />
                  <input type="hidden" name="questionId" value={item.questionId} />
                  <Button type="submit" size="sm" variant="secondary">Join a review</Button>
                </form>
              )}
            </div>
          ))}
        </Card>
      ) : null}
      {isStaff ? (
        <>
          <Card>
            <CardTitle>Add a question</CardTitle>
            <CardText>Questions lock after the first attempt.</CardText>
            <form action={addQuestionAction} className="mt-4 grid gap-3">
              <input type="hidden" name="quizId" value={quiz.id} />
              <Field label="Type" name="type">
                <Select id="type" name="type" defaultValue="SINGLE">
                  <option value="SINGLE">Single choice</option>
                  <option value="MULTIPLE">Multiple choice</option>
                  <option value="TRUE_FALSE">True or false</option>
                  <option value="SHORT">Short answer</option>
                  <option value="NUMERICAL">Numerical</option>
                  <option value="ESSAY">Essay</option>
                </Select>
              </Field>
              <Field label="Prompt" name="prompt">
                <Textarea id="prompt" name="prompt" required />
              </Field>
              <Field label="Points" name="points">
                <Input id="points" name="points" type="number" min={1} defaultValue={1} />
              </Field>
              <Field label="Option 1" name="option1">
                <Input id="option1" name="option1" />
              </Field>
              <Field label="Option 2" name="option2">
                <Input id="option2" name="option2" />
              </Field>
              <Field label="Option 3" name="option3">
                <Input id="option3" name="option3" />
              </Field>
              <Field label="Option 4" name="option4">
                <Input id="option4" name="option4" />
              </Field>
              <Field label="Correct option numbers" name="correct" hint="For true/false type true or false in the short-answer box. For multiple choice, tick every correct number.">
                <div className="flex gap-3 text-sm">
                  {[1, 2, 3, 4].map((number) => (
                    <label key={number} className="flex items-center gap-1">
                      <input type="checkbox" name="correct" value={number} /> {number}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Short answer, true/false, or number" name="correctText">
                <Input id="correctText" name="correctText" />
              </Field>
              <Field label="Numerical answer" name="numericalAnswer">
                <Input id="numericalAnswer" name="numericalAnswer" type="number" step="any" />
              </Field>
              <Field label="Tolerance" name="numericalTolerance">
                <Input id="numericalTolerance" name="numericalTolerance" type="number" step="any" defaultValue={0} />
              </Field>
              <Button type="submit">Add question</Button>
            </form>
          </Card>
          <form action={publishQuizAction}>
            <input type="hidden" name="quizId" value={quiz.id} />
            <Button type="submit">Publish quiz</Button>
          </form>
          <Card>
            <CardTitle>Questions</CardTitle>
            {quiz.questions.map((question) => (
              <p key={question.id} className="mt-2 text-sm">
                {question.prompt} · {question.type.toLowerCase()} · {question.points} pts
                {question.options.filter((option) => option.correct).map((option) => ` · ${option.text}`)}
              </p>
            ))}
          </Card>
          {quiz.attempts
            .filter((attempt) => attempt.status === "SUBMITTED")
            .map((attempt) => (
              <Card key={attempt.id}>
                <CardTitle>{attempt.student.name}</CardTitle>
                <CardText>
                  Score {attempt.score} / {attempt.maxScore}
                </CardText>
                {attempt.answers
                  .filter((answer) => answer.awardedPoints === null || quiz.questions.find((question) => question.id === answer.questionId)?.type === "ESSAY")
                  .map((answer) => (
                    <form key={answer.id} action={gradeEssayAction} className="mt-3 grid gap-2">
                      <input type="hidden" name="answerId" value={answer.id} />
                      <p className="text-sm">{answer.textAnswer}</p>
                      <Input name="points" type="number" min={0} defaultValue={answer.awardedPoints ?? 0} aria-label="Essay points" />
                      <Textarea name="feedback" defaultValue={answer.feedback} aria-label="Essay feedback" />
                      <Button type="submit" size="sm">
                        Save essay mark
                      </Button>
                    </form>
                  ))}
              </Card>
            ))}
          <form action={releaseQuizAction} className="grid gap-2">
            <input type="hidden" name="quizId" value={quiz.id} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pointsReleased" defaultChecked={quiz.pointsReleased} /> Release scores
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="answersReleased" defaultChecked={quiz.answersReleased} /> Release correct answers
            </label>
            <Button type="submit">Update release</Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
