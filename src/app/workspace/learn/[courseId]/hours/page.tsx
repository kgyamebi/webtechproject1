import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { addOfficeSlotAction, claimOfficeSlotAction, courseStudioAccess, releaseOfficeSlotAction } from "@/server/academic/studio";
import { joinOfficeQueueAction, leaveOfficeQueueAction, officeQueue, officeQueueNoteAction } from "@/server/campus-loop/actions";

export const metadata = { title: "Office hours" };

export default async function HoursPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const slots = await prisma.officeSlot.findMany({ where: { courseId }, orderBy: { startsAt: "asc" } });
  const queue = await officeQueue(courseId);

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Office hours</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">A lecturer publishes a slot. One student claims it and can say what they need. The host gets an in-app notice and an email copy. Either person can open the slot again. Push and SMS are not sent.</p>
      {queue ? (
        <section className="mt-8 max-w-2xl">
          <h2 className="font-display text-2xl">Queue</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Join with a reason. The lecturer can close the queue. A finished note stays on the assignment you named.</p>
          <ol className="mt-4 grid gap-3">
            {queue.waiting.filter((row) => row.visible).map((row) => (
              <li key={row.id} className="border-t border-line py-3 text-sm">
                <p className="font-medium">Place {row.position} · {row.studentName}</p>
                <p className="text-ink-soft">{row.reason}</p>
                {row.studentId === access.viewer.userId ? (
                  <form action={leaveOfficeQueueAction} className="mt-2">
                    <input type="hidden" name="id" value={row.id} />
                    <Button type="submit" size="sm" variant="secondary">Leave the queue</Button>
                  </form>
                ) : null}
                {queue.isStaff ? (
                  <form action={officeQueueNoteAction} className="mt-2 grid gap-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="queueAction" value="done" />
                    <Textarea name="note" aria-label="Note for the assignment" />
                    <Button type="submit" size="sm">Mark done and keep the note</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ol>
          {queue.isStaff && queue.waiting.length > 0 ? (
            <form action={officeQueueNoteAction} className="mt-3">
              <input type="hidden" name="id" value={queue.waiting[0]?.id ?? ""} />
              <input type="hidden" name="queueAction" value="close" />
              <Button type="submit" size="sm" variant="secondary">Close the queue</Button>
            </form>
          ) : null}
          {access.enrolled ? (
            <form action={joinOfficeQueueAction} className="mt-4 grid gap-2">
              <input type="hidden" name="courseId" value={courseId} />
              <Field label="Reason" name="reason"><Textarea id="reason" name="reason" required /></Field>
              <label className="grid gap-1 text-sm">
                Assignment for the note
                <select name="assignmentId" className="h-11 rounded-xl border border-line bg-transparent px-3">
                  <option value="">None</option>
                  {queue.assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm">Join the queue</Button>
            </form>
          ) : null}
        </section>
      ) : null}
      <ul className="mt-6 max-w-2xl">
        {slots.length === 0 ? <li className="text-sm text-ink-soft">No slots yet.</li> : null}
        {slots.map((slot) => (
          <li key={slot.id} className="border-t border-line py-4 text-sm">
            <p className="font-medium">{slot.hostName}</p>
            <p className="text-ink-soft">{slot.startsAt.toLocaleString()} – {slot.endsAt.toLocaleTimeString()}{slot.location ? ` · ${slot.location}` : ""}</p>
            <p className="mt-1">{slot.claimantId === access.viewer.userId ? "You have this slot" : slot.claimantName ? `Claimed by ${slot.claimantName}` : "Open"}</p>
            {slot.purpose && (slot.hostId === access.viewer.userId || slot.claimantId === access.viewer.userId) ? (
              <p className="mt-1 text-ink-soft">{slot.purpose}</p>
            ) : null}
            {access.enrolled && !slot.claimantId && slot.hostId !== access.viewer.userId ? (
              <form action={claimOfficeSlotAction} className="mt-3 grid max-w-md gap-2">
                <input type="hidden" name="slotId" value={slot.id} />
                <Field label="What you need" name={`purpose-${slot.id}`} hint="This note stays on the slot for you and the lecturer, and it is sent with the claim.">
                  <Textarea id={`purpose-${slot.id}`} name="purpose" />
                </Field>
                <Button type="submit" size="sm">Claim this slot</Button>
              </form>
            ) : null}
            {slot.claimantId && (slot.claimantId === access.viewer.userId || slot.hostId === access.viewer.userId) ? (
              <form action={releaseOfficeSlotAction} className="mt-3">
                <input type="hidden" name="slotId" value={slot.id} />
                <Button type="submit" size="sm" variant="secondary">Open this slot again</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {access.isStaff ? (
        <form action={addOfficeSlotAction} className="mt-8 grid max-w-md gap-3">
          <h2 className="font-display text-xl">Publish a slot</h2>
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Starts" name="slot-start"><Input id="slot-start" name="startsAt" type="datetime-local" required /></Field>
          <Field label="Ends" name="slot-end"><Input id="slot-end" name="endsAt" type="datetime-local" required /></Field>
          <Field label="Where" name="slot-where"><Input id="slot-where" name="location" /></Field>
          <Button type="submit">Publish slot</Button>
        </form>
      ) : null}
    </div>
  );
}
