import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { addOutcomeAction, addOutcomeLinkAction, courseStudioAccess } from "@/server/academic/studio";

export const metadata = { title: "Outcomes" };

export default async function OutcomesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const outcomes = await prisma.outcome.findMany({
    where: { courseId },
    orderBy: { title: "asc" },
    include: { links: { select: { assignmentId: true } } },
  });
  const assignments = await prisma.assignment.findMany({
    where: { courseId, published: true },
    select: { id: true, title: true, maxPoints: true, submissions: { where: { studentId: access.viewer.userId }, select: { points: true, released: true } } },
  });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Outcomes</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        Mastery is the average of released scores on the linked assignments, compared with the percent the lecturer set. There is no predicted grade.
      </p>
      <ul className="mt-6 max-w-2xl">
        {outcomes.length === 0 ? <li className="text-sm text-ink-soft">No outcomes yet.</li> : null}
        {outcomes.map((outcome) => {
          const linkedIds = new Set(outcome.links.map((link) => link.assignmentId));
          if (outcome.assignmentId) {
            linkedIds.add(outcome.assignmentId);
          }
          const linked = assignments.filter((item) => linkedIds.has(item.id));
          const released = linked.flatMap((assignment) => {
            const submission = assignment.submissions[0];
            if (!submission?.released || submission.points === null || submission.points === undefined || assignment.maxPoints <= 0) {
              return [];
            }
            return [Math.round((submission.points / assignment.maxPoints) * 100)];
          });
          const percent = released.length > 0 ? Math.round(released.reduce((sum, value) => sum + value, 0) / released.length) : null;
          const met = percent !== null && percent >= outcome.masteryPercent;
          return (
            <li key={outcome.id} className="border-t border-line py-4 text-sm">
              <p className="font-medium">{outcome.title}</p>
              {outcome.description ? <p className="mt-1 text-ink-soft">{outcome.description}</p> : null}
              <p className="mt-2 text-ink-soft">
                {linked.length > 0 ? linked.map((item) => item.title).join(", ") : "Not linked to an assignment yet."}
                {percent !== null ? ` · ${percent}% average · ${met ? "Met" : "Not met"} at ${outcome.masteryPercent}%` : " · Waiting for a released score."}
              </p>
              {percent !== null ? (
                <div className="mt-3 h-1 bg-line" aria-hidden="true">
                  <div className="h-1 bg-ink" style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
              ) : null}
              {access.isStaff ? (
                <form action={addOutcomeLinkAction} className="mt-3 grid max-w-md gap-2">
                  <input type="hidden" name="outcomeId" value={outcome.id} />
                  <Field label="Add an assignment" name={`link-${outcome.id}`}>
                    <Select name="assignmentId" defaultValue="">
                      <option value="" disabled>Choose an assignment</option>
                      {assignments.map((item) => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" size="sm" variant="secondary">Link assignment</Button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      {access.isStaff ? (
        <form action={addOutcomeAction} className="mt-8 grid max-w-xl gap-3">
          <h2 className="font-display text-xl">New outcome</h2>
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Title" name="outcome-title"><Input id="outcome-title" name="title" required minLength={2} /></Field>
          <Field label="Description" name="outcome-description"><Textarea id="outcome-description" name="description" /></Field>
          <Field label="Mastery percent" name="outcome-percent"><Input id="outcome-percent" name="masteryPercent" type="number" min={1} max={100} defaultValue={70} required /></Field>
          <Field label="Assignment" name="outcome-assignment" hint="Optional. Mastery uses the released score on this assignment. There is no predicted grade.">
            <Select name="assignmentId" defaultValue="">
              <option value="">No assignment yet</option>
              {assignments.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Add outcome</Button>
        </form>
      ) : null}
    </div>
  );
}
