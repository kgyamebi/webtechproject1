import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveThread } from "@/components/chat/live-thread";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PRESENCE_LABEL, UNSEND_MS } from "@/lib/campus-loop";
import {
  createPollAction,
  deleteMessageAction,
  editMessageAction,
  leaveGroupAction,
  loadConversation,
  muteConversationAction,
  pinMessageAction,
  reactMessageAction,
  sendMessageAction,
  votePollAction,
} from "@/server/social/actions";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; reply?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const conversation = await loadConversation(id, query.q ?? "");
  if (!conversation) {
    notFound();
  }
  const now = Date.now();
  const reply = conversation.messages.find((message) => message.id === query.reply);
  const pins = conversation.messages.filter((message) => message.pinnedAt && !message.deletedAt);
  const others = conversation.members.filter((member) => member.userId !== conversation.viewerId);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">
            {conversation.kind === "GROUP"
              ? conversation.title
              : others[0]?.user.name ?? "Conversation"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {others
              .map((member) => `${member.user.name} · ${PRESENCE_LABEL[member.user.profile?.presence ?? "AVAILABLE"]}`)
              .join(" · ") || "Just you in this chat."}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={muteConversationAction}>
            <input type="hidden" name="conversationId" value={conversation.id} />
            <Button type="submit" size="sm" variant="secondary">
              {conversation.muted ? "Unmute" : "Mute"}
            </Button>
          </form>
          {conversation.kind === "GROUP" ? (
            <form action={leaveGroupAction}>
              <input type="hidden" name="conversationId" value={conversation.id} />
              <Button type="submit" size="sm" variant="danger">
                Leave
              </Button>
            </form>
          ) : null}
        </div>
      </div>
      <Card>
        <CardTitle>Search</CardTitle>
        <form className="mt-4 flex flex-wrap gap-2" action={`/workspace/messages/${conversation.id}`}>
          <Input name="q" defaultValue={query.q ?? ""} aria-label="Search this conversation" placeholder="Search messages" />
          <Button type="submit" size="sm">Search</Button>
          {query.q ? (
            <Link href={`/workspace/messages/${conversation.id}`} className="self-center text-sm text-pine underline-offset-4 hover:underline">
              Clear
            </Link>
          ) : null}
        </form>
      </Card>
      {pins.length > 0 ? (
        <Card>
          <CardTitle>Pinned</CardTitle>
          <ul className="mt-3 grid gap-2 text-sm">
            {pins.map((message) => (
              <li key={message.id}>
                <span className="font-medium">{message.sender.name}.</span> {message.body}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card>
        <CardTitle>Thread</CardTitle>
        <ul className="mt-4 grid gap-4">
          {conversation.messages.map((message) => {
            const readers = conversation.members.filter(
              (member) =>
                member.userId !== message.senderId &&
                member.user.profile?.shareReadReceipts &&
                member.lastReadAt &&
                member.lastReadAt >= message.createdAt &&
                message.visibleAt <= new Date(),
            );
            const mine = message.sender.id === conversation.viewerId;
            const canUnsend = mine && !message.deletedAt && now - message.createdAt.getTime() <= UNSEND_MS;
            return (
              <li key={message.id} className={`border-b border-line pb-3 text-sm ${message.parentId ? "pl-4" : ""}`}>
                <p className="font-medium">{message.sender.name}</p>
                {message.parent ? (
                  <p className="text-xs text-ink-soft">
                    Reply to {message.parent.sender.name}: {message.parent.body.slice(0, 80)}
                  </p>
                ) : null}
                <p className="text-ink-soft">{message.deletedAt ? "Message unsent" : message.body}</p>
                {message.visibleAt.getTime() > now && mine ? (
                  <p className="text-xs text-ink-soft">Sends at {message.visibleAt.toLocaleString()}</p>
                ) : null}
                {message.kind === "voice" && message.attachmentPath && !message.deletedAt ? (
                  <audio className="mt-2" controls src={`/api/media/message/${message.id}`} />
                ) : null}
                {message.kind === "file" && message.attachmentPath && !message.deletedAt ? (
                  <a className="mt-2 inline-block text-pine underline-offset-4 hover:underline" href={`/api/media/message/${message.id}`}>
                    {message.attachmentName || "Download file"}
                  </a>
                ) : null}
                {message.poll && !message.deletedAt ? (
                  <ul className="mt-2 grid gap-2">
                    {message.poll.options.map((option) => (
                      <li key={option.id}>
                        <form action={votePollAction} className="flex items-center gap-2">
                          <input type="hidden" name="optionId" value={option.id} />
                          <Button type="submit" size="sm" variant="secondary">{option.label}</Button>
                          <span className="text-xs text-ink-soft">{option.votes.length}</span>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {message.editedAt && !message.deletedAt ? <p className="text-xs text-ink-soft">Edited</p> : null}
                {readers.length > 0 && mine ? (
                  <p className="text-xs text-ink-soft">Read by {readers.map((member) => member.user.name).join(", ")}</p>
                ) : null}
                <p className="text-xs text-ink-soft">{message.reactions.map((reaction) => reaction.emoji).join(" ")}</p>
                {!message.deletedAt ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["👍", "✅", "❓"].map((emoji) => (
                      <form key={emoji} action={reactMessageAction}>
                        <input type="hidden" name="messageId" value={message.id} />
                        <input type="hidden" name="emoji" value={emoji} />
                        <Button type="submit" size="sm" variant="ghost">{emoji === "👍" ? "React" : emoji}</Button>
                      </form>
                    ))}
                    <Link className="inline-flex h-8 items-center px-2 text-sm text-ink-soft underline-offset-4 hover:underline" href={`/workspace/messages/${conversation.id}?reply=${message.id}`}>
                      Reply
                    </Link>
                    <form action={pinMessageAction}>
                      <input type="hidden" name="messageId" value={message.id} />
                      <Button type="submit" size="sm" variant="ghost">{message.pinnedAt ? "Unpin" : "Pin"}</Button>
                    </form>
                    {mine ? (
                      <form action={editMessageAction} className="flex gap-2">
                        <input type="hidden" name="messageId" value={message.id} />
                        <Input name="body" defaultValue={message.body} aria-label="Edit message" />
                        <Button type="submit" size="sm" variant="secondary">Edit</Button>
                      </form>
                    ) : null}
                    {canUnsend ? (
                      <form action={deleteMessageAction}>
                        <input type="hidden" name="messageId" value={message.id} />
                        <Button type="submit" size="sm" variant="danger">Unsend</Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <form action={sendMessageAction} className="mt-4 grid gap-3">
          <input type="hidden" name="conversationId" value={conversation.id} />
          {reply ? <input type="hidden" name="parentId" value={reply.id} /> : null}
          {reply ? <p className="text-xs text-ink-soft">Replying to {reply.sender.name}. This stays in the chat.</p> : null}
          <Field label="Message" name="body">
            <Textarea id="body" name="body" maxLength={2000} />
          </Field>
          <Field label="File for this chat" name="file" hint="Optional image or PDF under 2 MB. This is not the assignment submission.">
            <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" />
          </Field>
          <Field label="Send later" name="visibleAt" hint="Leave blank to send now. A future time stays hidden until then.">
            <Input id="visibleAt" name="visibleAt" type="datetime-local" />
          </Field>
          <LiveThread conversationId={conversation.id} />
          <Button type="submit">Send</Button>
        </form>
        <form action={createPollAction} className="mt-6 grid gap-3 border-t border-line pt-4">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <Field label="Poll" name="question">
            <Input id="question" name="question" maxLength={200} />
          </Field>
          <Field label="Option 1" name="option1"><Input id="option1" name="option1" /></Field>
          <Field label="Option 2" name="option2"><Input id="option2" name="option2" /></Field>
          <Field label="Option 3" name="option3"><Input id="option3" name="option3" /></Field>
          <Button type="submit" variant="secondary">Post poll</Button>
        </form>
      </Card>
    </div>
  );
}
