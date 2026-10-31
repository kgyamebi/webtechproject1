import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerField } from "@/components/academic/answer-field";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { canReadGrade, submissionAccepted } from "@/server/academic/rules";
import { gradeSubmissionAction, loadAssignment, submitAssignmentAction } from "@/server/academic/actions";
import { addRubricCriterionAction, addRubricLevelAction, addSubmissionNoteAction, loadMarking, markRubricAction } from "@/server/academic/studio";

export const metadata = { title: "Assignment" };

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { courseId, assignmentId } = await params;
  const loaded = await loadAssignment(courseId, assignmentId);
  if (!loaded) {
    notFound();
  }
  const { assignment, isStaff, viewerId, archived } = loaded;
  const mine = assignment.submissions.find((submission) => submission.studentId === viewerId);
  const window = submissionAccepted(new Date(), assignment.dueAt, assignment.allowLate);
  const graded = mine?.points !== null && mine?.points !== undefined;
  const marking = await loadMarking(courseId, assignmentId);

  return (
    <div className="grid gap-6">
      <div>
        <Link className="text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>
          Back to course
        </Link>
        <h1 className="mt-2 font-display text-4xl">{assignment.title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{assignment.instructions}</p>
        <p className="mt-2 text-sm">
          Due {assignment.dueAt.toLocaleString()} · {assignment.maxPoints} points
          {assignment.allowLate ? " · late work accepted" : ""}
        </p>
      </div>
      {marking && marking.criteria.length > 0 ? (
        <section aria-label="How this is marked">
          <h2 className="font-display text-xl">How this is marked</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">
            These lines are the score. Points on a line stay hidden until the grade is released.
          </p>
          <ul className="mt-3 grid gap-3 text-sm">
            {marking.criteria.map((criterion) => {
              const mark = mine ? criterion.marks.find((item) => item.submissionId === mine.id) : undefined;
              const show = Boolean(!isStaff && mine?.released && mark);
              return (
                <li key={criterion.id} className="border-t border-line py-3">
                  <p className="font-medium">{criterion.title}</p>
                  <p className="text-ink-soft">Up to {criterion.points} points</p>
                  {criterion.levels.length > 0 ? (
                    <ul className="mt-2 grid gap-1 text-ink-soft">
                      {criterion.levels.map((level) => (
                        <li key={level.id}>{level.label} · {level.points}{level.description ? ` · ${level.description}` : ""}</li>
                      ))}
                    </ul>
                  ) : null}
                  {isStaff ? null : <p className="mt-2">{show ? `${mark?.points} / ${criterion.points}` : "Shown when the grade is released."}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {!isStaff && !archived ? (
        <Card>
          <CardTitle>{mine ? "Submitted" : "Not submitted yet"}</CardTitle>
          {mine ? (
            <CardText>
              Sent {mine.submittedAt.toLocaleString()}
              {mine.late ? " · late" : ""}
              {canReadGrade({ isStaff: false, isOwner: true, released: mine.released })
                ? ` · ${mine.points} / ${assignment.maxPoints}. ${mine.feedback}`
                : " · waiting for a released grade"}
            </CardText>
          ) : null}
          {window.ok && !graded ? (
            <form action={submitAssignmentAction} className="mt-4 grid gap-3">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <AnswerField defaultValue={mine?.body ?? ""} />
              <Field label="File" name="file" hint="Optional JPEG, PNG, WebP, or PDF under 2 MB.">
                <input id="file" name="file" type="file" className="text-sm" />
              </Field>
              <Button type="submit">Submit</Button>
            </form>
          ) : (
            <CardText>{window.ok ? "A grade is recorded, so this answer stays as submitted." : window.reason}</CardText>
          )}
          {mine?.filePath ? (
            <a className="mt-3 inline-block text-sm text-pine underline-offset-4 hover:underline" href={`/api/media/submission/${mine.id}`}>
              Download your file
            </a>
          ) : null}
        </Card>
      ) : null}
      {isStaff
        ? assignment.submissions.map((submission) => (
            <Card key={submission.id}>
              <CardTitle>{submission.student.name}</CardTitle>
              <CardText>
                {submission.body || "No text."} {submission.late ? "Late." : ""}
              </CardText>
              {submission.filePath ? (
                <a className="text-sm text-pine underline-offset-4 hover:underline" href={`/api/media/submission/${submission.id}`}>
                  Download file
                </a>
              ) : null}
              <form action={gradeSubmissionAction} className="mt-4 grid gap-3">
                <input type="hidden" name="submissionId" value={submission.id} />
                <Field label="Points" name={`points-${submission.id}`}>
                  <Input id={`points-${submission.id}`} name="points" type="number" min={0} max={assignment.maxPoints} defaultValue={submission.points ?? 0} required />
                </Field>
                <Field label="Feedback" name={`feedback-${submission.id}`}>
                  <Textarea id={`feedback-${submission.id}`} name="feedback" defaultValue={submission.feedback} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="released" defaultChecked={submission.released} /> Release to the student
                </label>
                <Button type="submit">Save grade</Button>
              </form>
            </Card>
          ))
        : null}
      {isStaff && marking && marking.criteria.length > 0 ? (
        <section>
          <h2 className="font-display text-xl">Rubric</h2>
          <ul className="mt-3 grid gap-3 text-sm">
            {marking.criteria.map((criterion) => (
              <li key={criterion.id} className="border-t border-line py-3">
                <p className="font-medium">{criterion.title}</p>
                <p className="text-ink-soft">Up to {criterion.points} points</p>
                {criterion.levels.length > 0 ? (
                  <ul className="mt-2 grid gap-1 text-ink-soft">
                    {criterion.levels.map((level) => (
                      <li key={level.id}>{level.label} · {level.points}{level.description ? ` · ${level.description}` : ""}</li>
                    ))}
                  </ul>
                ) : null}
                {isStaff
                  ? assignment.submissions.map((submission) => {
                      const mark = criterion.marks.find((item) => item.submissionId === submission.id);
                      const choices = criterion.levels.length > 0
                        ? criterion.levels.map((level) => [level.label, level.points] as const)
                        : ([["Full", criterion.points], ["Half", Math.floor(criterion.points / 2)], ["None", 0]] as const);
                      return (
                        <div key={submission.id} className="mt-3 grid gap-2">
                          <p className="text-ink-soft">{submission.student.name}</p>
                          <div className="flex flex-wrap gap-2">
                            {choices.map(([label, value]) => (
                              <form key={String(label)} action={markRubricAction}>
                                <input type="hidden" name="submissionId" value={submission.id} />
                                <input type="hidden" name="criterionId" value={criterion.id} />
                                <input type="hidden" name="points" value={value} />
                                <input type="hidden" name="comment" value={mark?.comment ?? ""} />
                                <Button type="submit" size="sm" variant={mark?.points === value ? "primary" : "secondary"}>{label}</Button>
                              </form>
                            ))}
                          </div>
                          <form action={markRubricAction} className="grid gap-2">
                            <input type="hidden" name="submissionId" value={submission.id} />
                            <input type="hidden" name="criterionId" value={criterion.id} />
                            <Field label="Points" name={`rubric-${criterion.id}-${submission.id}`}>
                              <Input id={`rubric-${criterion.id}-${submission.id}`} name="points" type="number" min={0} max={criterion.points} defaultValue={mark?.points ?? 0} required />
                            </Field>
                            <Field label="Comment" name={`note-${criterion.id}-${submission.id}`}>
                              <Input id={`note-${criterion.id}-${submission.id}`} name="comment" defaultValue={mark?.comment ?? ""} />
                            </Field>
                            <Button type="submit" variant="secondary" size="sm">Save criterion</Button>
                          </form>
                        </div>
                      );
                    })
                    : null}
                {isStaff ? (
                  <form action={addRubricLevelAction} className="mt-3 grid gap-2">
                    <input type="hidden" name="criterionId" value={criterion.id} />
                    <Field label="Level name" name={`level-label-${criterion.id}`}><Input name="label" required minLength={2} /></Field>
                    <Field label="Level points" name={`level-points-${criterion.id}`}><Input name="points" type="number" min={0} max={criterion.points} required /></Field>
                    <Field label="What this level means" name={`level-description-${criterion.id}`}><Input name="description" /></Field>
                    <Button type="submit" size="sm" variant="secondary">Add level</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {isStaff ? (
        <form action={addRubricCriterionAction} className="grid gap-3 border-t border-line py-5">
          <h2 className="font-display text-xl">Add a rubric criterion</h2>
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <Field label="Criterion" name="criterion-title">
            <Input id="criterion-title" name="title" required minLength={2} />
          </Field>
          <Field label="Points" name="criterion-points">
            <Input id="criterion-points" name="points" type="number" min={1} max={1000} required />
          </Field>
          <Button type="submit" variant="secondary">Add criterion</Button>
        </form>
      ) : null}
      {marking ? (
        <section>
          <h2 className="font-display text-xl">Marking notes</h2>
          {!isStaff && mine && !mine.released ? <p className="mt-3 text-sm text-ink-soft">Notes stay hidden until the grade is released.</p> : null}
          <ul className="mt-3 grid gap-2 text-sm">
            {marking.notes.filter((note) => isStaff || (mine?.released && note.submissionId === mine.id)).length === 0 && (isStaff || !mine || mine.released) ? <li className="text-ink-soft">No notes yet.</li> : null}
            {marking.notes
              .filter((note) => isStaff || (mine?.released && note.submissionId === mine.id))
              .map((note) => (
                <li key={note.id} className="border-t border-line py-2">
                  {note.quote ? <p className="text-ink-soft">“{note.quote}”</p> : null}
                  {note.body}
                  <span className="text-ink-soft"> · {note.createdAt.toLocaleString()}</span>
                </li>
              ))}
          </ul>
          {isStaff
            ? assignment.submissions.map((submission) => (
                <form key={submission.id} action={addSubmissionNoteAction} className="mt-4 grid gap-2">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <Field label={`Note for ${submission.student.name}`} name={`mark-note-${submission.id}`}>
                    <Textarea id={`mark-note-${submission.id}`} name="body" required />
                  </Field>
                  <Field label="Quote from the answer" name={`mark-quote-${submission.id}`} hint="Optional. The words you are commenting on.">
                    <Input name="quote" />
                  </Field>
                  <Button type="submit" variant="secondary" size="sm">Add note</Button>
                </form>
              ))
            : null}
        </section>
      ) : null}
    </div>
  );
}
