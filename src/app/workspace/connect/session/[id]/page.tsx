import Link from "next/link";
import { notFound } from "next/navigation";
import { CallAvailability } from "@/components/call/call-availability";
import { LiveConversation } from "@/components/connect/live-conversation";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { sessionOpen } from "@/server/connect/rules";
import {
  connectBlockAction,
  connectFriendAction,
  connectReportAction,
  endConnectSessionAction,
  loadConnectSession,
  nextPromptAction,
  sendConnectMessageAction,
} from "@/server/connect/actions";

export const metadata = { title: "Conversation" };

export default async function ConnectSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadConnectSession(id);
  if (!loaded) {
    notFound();
  }
  const { session, alias, reasons, prompt, otherId, friends } = loaded;
  const open = sessionOpen(session.status);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-[var(--hairline)] px-3 py-2">
        <div className="flex items-center gap-2">
          <Link href="/workspace/connect" className="grid h-10 w-10 place-items-center rounded-full text-sm" aria-label="Back to Connect">
            Back
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl">{alias}</h1>
            <p className="truncate text-xs text-[var(--screen-soft)]">
              {open ? "Live" : "Closed"} · {reasons.length > 0 ? reasons.join(", ") : "No shared tags"}
            </p>
          </div>
          {open ? (
            <ConfirmDialog
              trigger={<Button type="button" size="sm" variant="secondary">End conversation</Button>}
              title="End this conversation?"
              description="Both people leave the chat. You can start another match afterwards."
            >
              <form action={endConnectSessionAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <Button type="submit" variant="danger">
                  End for both
                </Button>
              </form>
            </ConfirmDialog>
          ) : null}
        </div>
        {open ? null : <CallAvailability scope="connect" id={session.id} open={false} appearance="phone" />}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {otherId && !friends ? (
            <form action={connectFriendAction}>
              <input type="hidden" name="userId" value={otherId} />
              <Button type="submit" size="sm">
                Add friend
              </Button>
            </form>
          ) : null}
          {friends ? <p className="text-xs text-[var(--screen-soft)]">Already friends. Names stay on Friends.</p> : null}
          {otherId ? (
            <ConfirmDialog
              trigger={<Button type="button" size="sm" variant="danger">Block</Button>}
              title="Block this person?"
              description="You will not be matched again, and this conversation closes."
            >
              <form action={connectBlockAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="userId" value={otherId} />
                <Button type="submit" variant="danger">
                  Block and close
                </Button>
              </form>
            </ConfirmDialog>
          ) : null}
          <details className="text-sm">
            <summary className="cursor-pointer rounded-full px-2 py-1 text-xs text-[var(--screen-soft)]">Report</summary>
            <form action={connectReportAction} className="grid gap-2 py-2">
              <input type="hidden" name="sessionId" value={session.id} />
              <Field label="Report category" name="category">
                <Select id="category" name="category" defaultValue="HARASSMENT">
                  <option value="HARASSMENT">Harassment</option>
                  <option value="BULLYING">Bullying</option>
                  <option value="THREATS">Threats</option>
                  <option value="IMPERSONATION">Impersonation</option>
                  <option value="SEXUAL_HARASSMENT">Sexual harassment</option>
                  <option value="INAPPROPRIATE">Inappropriate content</option>
                  <option value="SPAM">Spam</option>
                  <option value="AGE_CONCERN">Age concern</option>
                  <option value="OTHER">Other safety concern</option>
                </Select>
              </Field>
              <Field label="What happened" name="reason" hint="A moderator can read this report. The other person is not told who reported them.">
                <Input id="reason" name="reason" required minLength={5} maxLength={500} />
              </Field>
              <Button type="submit" size="sm" variant="secondary">
                Submit report
              </Button>
            </form>
          </details>
        </div>
      </header>
      {open ? <CallAvailability scope="connect" id={session.id} open appearance="phone" /> : null}
      {session.messages.length === 0 ? (
        <form action={nextPromptAction} className="border-b border-[var(--hairline)] px-4 py-2">
          <input type="hidden" name="sessionId" value={session.id} />
          <p className="text-xs uppercase tracking-wide text-[var(--screen-soft)]">{prompt.category}</p>
          <p className="text-sm">{prompt.text}</p>
          <button type="submit" className="mt-1 text-xs font-medium text-[var(--bubble-me)]">
            Another prompt
          </button>
        </form>
      ) : null}
      <LiveConversation
        initial={session.messages.map((message) => ({
          id: message.id,
          body: message.body,
          mine: message.senderId === loaded.mine,
          createdAt: message.createdAt.toISOString(),
        }))}
        streamUrl={`/api/connect/session/${session.id}/stream`}
        typingUrl={`/api/connect/session/${session.id}/typing`}
        closed={!open}
        maxLength={500}
        action={sendConnectMessageAction}
        fields={[{ name: "sessionId", value: session.id }]}
        idempotent
      />
    </div>
  );
}
