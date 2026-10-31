import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { loadQuiet, quietAction, sendQuietMessageAction } from "@/server/social/actions";

export const metadata = { title: "Introduction" };

export default async function QuietThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intro = await loadQuiet(id);
  if (!intro) {
    notFound();
  }
  const chatting = intro.status === "ACTIVE" || intro.status === "REVEAL_REQUESTED" || intro.status === "REVEALED";

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/workspace/quiet" className="text-sm text-pine underline-offset-4 hover:underline">
          Back to Quiet Connect
        </Link>
        <h1 className="mt-2 font-display text-4xl">{intro.label}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{statusCopy(intro.status, intro.viewerAccepted, intro.revealAskedByViewer)}</p>
        {intro.status === "ENDED" || intro.status === "REPORTED" ? null : (
          <ol className="mt-4 grid gap-2 text-sm" aria-label="Introduction steps">
            {steps(intro.status).map((step) => (
              <li key={step.label} className={step.current ? "font-medium text-ink" : "text-ink-soft"} aria-current={step.current ? "step" : undefined}>
                {step.done ? "Done · " : step.current ? "Now · " : ""}
                {step.label}
              </li>
            ))}
          </ol>
        )}
      </div>
      {intro.starters ? (
        <Card>
          <CardTitle>Their starter</CardTitle>
          <CardText>{intro.starters}</CardText>
        </Card>
      ) : null}
      <Card>
        <CardTitle>This step</CardTitle>
        <CardText>A real name appears only after both people agree. Agreeing does not create a friendship.</CardText>
        <div className="mt-4 flex flex-wrap gap-2">
          {intro.status === "INTRODUCTION_CREATED" && !intro.viewerAccepted ? (
            <>
              <QuietButton id={intro.id} event="ACCEPT" label="Accept introduction" />
              <QuietButton id={intro.id} event="DECLINE" label="Decline" secondary />
            </>
          ) : null}
          {intro.status === "INTRODUCTION_CREATED" && intro.viewerAccepted ? (
            <p className="text-sm text-ink-soft">{intro.partnerAccepted ? "Both accepted." : "You accepted. Waiting for the other person."}</p>
          ) : null}
          {intro.status === "ACTIVE" ? <QuietButton id={intro.id} event="ASK_REVEAL" label="Ask to share real names" /> : null}
          {intro.status === "REVEAL_REQUESTED" && intro.revealAskedByViewer ? (
            <p className="text-sm text-ink-soft">You asked to share names. Nothing changes until they agree.</p>
          ) : null}
          {intro.status === "REVEAL_REQUESTED" && !intro.revealAskedByViewer ? (
            <>
              <QuietButton id={intro.id} event="CONSENT_REVEAL" label="Share names" />
              <QuietButton id={intro.id} event="REJECT_REVEAL" label="Keep aliases" secondary />
            </>
          ) : null}
          {intro.status !== "ENDED" && intro.status !== "REPORTED" ? <QuietButton id={intro.id} event="END" label="End introduction" secondary /> : null}
        </div>
        {intro.status !== "ENDED" && intro.status !== "REPORTED" ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-ink-soft">Report this introduction</summary>
            <form action={quietAction} className="mt-3 grid gap-2">
              <input type="hidden" name="id" value={intro.id} />
              <input type="hidden" name="event" value="REPORT" />
              <Field label="What happened" name="reason">
                <Input id="reason" name="reason" required minLength={5} />
              </Field>
              <Button type="submit" variant="danger" size="sm">
                Send report
              </Button>
            </form>
          </details>
        ) : null}
      </Card>
      <Card>
        <CardTitle>Messages</CardTitle>
        {intro.messages.length === 0 ? <CardText>{chatting ? "Say hello with the alias on this page." : "Messages open after both people accept."}</CardText> : null}
        <ul className="mt-4 grid gap-3">
          {intro.messages.map((message) => (
            <li key={message.id} className={message.mine ? "ml-8 rounded-2xl bg-pine/15 px-3 py-2 text-sm" : "mr-8 rounded-2xl bg-canvas px-3 py-2 text-sm"}>
              <span className="font-medium">{message.mine ? "You" : intro.label}</span>
              <p>{message.body}</p>
            </li>
          ))}
        </ul>
        {chatting ? (
          <form action={sendQuietMessageAction} className="mt-4 grid gap-3">
            <input type="hidden" name="id" value={intro.id} />
            <Field label="Message" name="body">
              <Textarea id="body" name="body" required maxLength={1000} />
            </Field>
            <Button type="submit">Send</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}

function QuietButton({ id, event, label, secondary }: { id: string; event: string; label: string; secondary?: boolean }) {
  return (
    <form action={quietAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="event" value={event} />
      <Button type="submit" size="sm" variant={secondary ? "secondary" : "primary"}>
        {label}
      </Button>
    </form>
  );
}

function steps(status: string) {
  const order = ["INTRODUCTION_CREATED", "ACTIVE", "REVEAL_REQUESTED", "REVEALED"];
  const labels = ["Both people accept", "Talk under aliases", "One person asks to share names", "Both agree, then names appear"];
  const index = order.indexOf(status);
  return labels.map((label, position) => ({
    label,
    done: index > position,
    current: index === position,
  }));
}

function statusCopy(status: string, viewerAccepted: boolean, asked: boolean) {
  if (status === "INTRODUCTION_CREATED") {
    return viewerAccepted
      ? "You accepted. The conversation stays closed until the other person accepts too."
      : "This person is still an alias. Accept if you want to talk. Decline ends it for both of you.";
  }
  if (status === "ACTIVE") {
    return "You are talking under aliases. Either person can ask to share real names. The other person has to agree.";
  }
  if (status === "REVEAL_REQUESTED") {
    return asked ? "You asked to share names. The alias stays until they agree." : "They asked to share real names. You can agree or keep the aliases.";
  }
  if (status === "REVEALED") {
    return "Names are visible to both of you. This did not create a friendship.";
  }
  if (status === "REPORTED") {
    return "This introduction was reported and is closed.";
  }
  return "This introduction has ended.";
}
