import Link from "next/link";
import { InboxScreen } from "@/components/connect/inbox-screen";
import { loadConnectInbox } from "@/server/connect/actions";

export const metadata = { title: "Connect" };

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const notice = (await searchParams).notice;
  const home = await loadConnectInbox();

  if (!home.adult) {
    return (
      <div className="flex h-full flex-col justify-center px-6">
        <h1 className="font-display text-4xl">Connect</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--screen-soft)]">Closed for under-18 accounts. Course tools stay available from Learn.</p>
        <Link href="/workspace/learn" className="mt-6 text-sm font-medium text-[var(--bubble-me)]">
          Back to Learn
        </Link>
      </div>
    );
  }

  const threads = [
    ...home.conversations.map((conversation) => ({
      id: conversation.id,
      href: `/workspace/connect/chat/${conversation.id}`,
      title: conversation.title,
      preview: conversation.preview,
      at: conversation.at,
      unread: conversation.unread,
      kind: conversation.kind === "GROUP" ? ("group" as const) : ("friend" as const),
    })),
    ...home.sessions
      .filter((session) => session.open)
      .map((session) => ({
        id: session.id,
        href: `/workspace/connect/session/${session.id}`,
        title: session.alias,
        preview: "Random Connect",
        at: session.startedAt,
        unread: false,
        kind: "random" as const,
      })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());

  return <InboxScreen threads={threads} friends={home.friends} notice={notice} />;
}
