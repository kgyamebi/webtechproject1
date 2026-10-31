import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { addOfficeSlotAction, claimOfficeSlotAction, courseStudioAccess, releaseOfficeSlotAction } from "@/server/academic/studio";

export const metadata = { title: "Office hours" };

export default async function HoursPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const slots = await prisma.officeSlot.findMany({ where: { courseId }, orderBy: { startsAt: "asc" } });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Office hours</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">A lecturer publishes a slot. One student claims it and can say what they need. The host gets an in-app notice and an email copy. Either person can open the slot again. Push and SMS are not sent.</p>
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
