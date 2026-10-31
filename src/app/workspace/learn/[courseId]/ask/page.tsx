import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { askCourseAction, courseStudioAccess, replyCourseAction } from "@/server/academic/studio";

export const metadata = { title: "Ask" };

export default async function AskPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const questions = await prisma.courseQuestion.findMany({
    where: access.isStaff ? { courseId } : { courseId, authorId: access.viewer.userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Ask the course</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        A question goes to the people teaching this course. It is not a social message, and it does not open a chat with another student. You see your own questions. A reply is copied to email when mail can be sent.
      </p>
      <ul className="mt-6 max-w-2xl">
        {questions.length === 0 ? <li className="text-sm text-ink-soft">No questions yet.</li> : null}
        {questions.map((question) => (
          <li key={question.id} className="border-t border-line py-4 text-sm">
            <p className="font-medium">{question.authorName}</p>
            <p className="mt-1 whitespace-pre-wrap leading-6">{question.body}</p>
            {question.reply ? (
              <p className="mt-3 border-l border-line pl-3 leading-6">
                <span className="font-medium">{question.repliedByName}</span>
                <span className="mt-1 block whitespace-pre-wrap">{question.reply}</span>
              </p>
            ) : access.isStaff ? (
              <form action={replyCourseAction} className="mt-3 grid gap-2">
                <input type="hidden" name="questionId" value={question.id} />
                <Field label={`Reply to ${question.authorName}`} name={`reply-${question.id}`}>
                  <Textarea name="reply" required minLength={2} />
                </Field>
                <Button type="submit" size="sm" variant="secondary">Send reply</Button>
              </form>
            ) : (
              <p className="mt-2 text-ink-soft">Waiting for a reply.</p>
            )}
          </li>
        ))}
      </ul>
      {access.enrolled && !access.isStaff ? (
        <form action={askCourseAction} className="mt-8 grid max-w-xl gap-3">
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Your question" name="course-question">
            <Textarea id="course-question" name="body" required minLength={2} />
          </Field>
          <Button type="submit">Send to the course</Button>
        </form>
      ) : null}
    </div>
  );
}
