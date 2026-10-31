import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveConversation } from "@/components/connect/live-conversation";
import { requireUser } from "@/server/auth/current";
import { loadConversation, sendMessageResultAction } from "@/server/social/actions";

export const metadata = { title: "Conversation" };

export default async function ConnectFriendChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser();
  const conversation = await loadConversation(id);
  if (!conversation) {
    notFound();
  }
  const title =
    conversation.kind === "GROUP"
      ? conversation.title
      : conversation.members.find((member) => member.userId !== viewer.userId)?.user.name ?? "Conversation";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-[var(--hairline)] px-3 py-2">
        <Link href="/workspace/connect" className="grid h-10 w-10 place-items-center rounded-full text-sm" aria-label="Back to Connect">
          Back
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl">{title}</h1>
          <p className="text-xs text-[var(--screen-soft)]">{conversation.kind === "GROUP" ? "Group" : "Friend"}</p>
        </div>
        <Link href={`/workspace/messages/${conversation.id}`} className="text-xs font-medium text-[var(--bubble-me)]">
          Tools
        </Link>
      </header>
      <LiveConversation
        initial={conversation.messages.map((message) => ({
          id: message.id,
          body: message.deletedAt ? "Message deleted" : message.body,
          mine: message.senderId === viewer.userId,
          createdAt: message.createdAt.toISOString(),
        }))}
        streamUrl={`/api/messages/${conversation.id}/stream`}
        typingUrl={`/api/messages/${conversation.id}/typing`}
        closed={false}
        maxLength={2000}
        action={sendMessageResultAction}
        fields={[{ name: "conversationId", value: conversation.id }]}
      />
    </div>
  );
}
