import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  deleteMessageAction,
  editMessageAction,
  leaveGroupAction,
  loadConversation,
  muteConversationAction,
  reactMessageAction,
  sendMessageAction,
} from "@/server/social/actions";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await loadConversation(id);
  if (!conversation) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">
          {conversation.kind === "GROUP"
            ? conversation.title
            : conversation.members.find((member) => member.userId !== conversation.viewerId)?.user.name ?? "Conversation"}
        </h1>
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
        <CardTitle>Thread</CardTitle>
        <ul className="mt-4 grid gap-4">
          {conversation.messages.map((message) => (
            <li key={message.id} className="border-b border-line pb-3 text-sm">
              <p className="font-medium">{message.sender.name}</p>
              <p className="text-ink-soft">{message.deletedAt ? "Message deleted" : message.body}</p>
              {message.editedAt && !message.deletedAt ? <p className="text-xs text-ink-soft">Edited</p> : null}
              <p className="text-xs text-ink-soft">{message.reactions.map((reaction) => reaction.emoji).join(" ")}</p>
              {!message.deletedAt ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={reactMessageAction}>
                    <input type="hidden" name="messageId" value={message.id} />
                    <input type="hidden" name="emoji" value="👍" />
                    <Button type="submit" size="sm" variant="ghost">
                      React
                    </Button>
                  </form>
                  {message.sender.id === conversation.viewerId ? (
                    <>
                      <form action={editMessageAction} className="flex gap-2">
                        <input type="hidden" name="messageId" value={message.id} />
                        <Input name="body" defaultValue={message.body} aria-label="Edit message" />
                        <Button type="submit" size="sm" variant="secondary">
                          Edit
                        </Button>
                      </form>
                      <form action={deleteMessageAction}>
                        <input type="hidden" name="messageId" value={message.id} />
                        <Button type="submit" size="sm" variant="danger">
                          Delete
                        </Button>
                      </form>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <form action={sendMessageAction} className="mt-4 grid gap-3">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <Field label="Message" name="body">
            <Textarea id="body" name="body" required maxLength={2000} />
          </Field>
          <Button type="submit">Send</Button>
        </form>
      </Card>
    </div>
  );
}
