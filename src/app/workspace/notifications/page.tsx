import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { listNotifications, markNotificationReadAction } from "@/server/campus/actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const unreadOnly = view === "unread";
  const all = await listNotifications();
  const notes = unreadOnly ? all.filter((note) => !note.readAt) : all;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Notifications</h1>
        <form action={markNotificationReadAction}>
          <input type="hidden" name="id" value="all" />
          <Button type="submit" size="sm" variant="secondary">
            Mark all read
          </Button>
        </form>
      </div>
      <p className="text-sm leading-6 text-ink-soft">Course notices sit apart from people and campus. Academic notes, discussion replies, and office-hour claims are also copied to email when mail can be sent.</p>
      <nav aria-label="Notification views" className="flex gap-4 text-sm">
        <Link className={unreadOnly ? "text-ink-soft" : "font-medium text-ink"} href="/workspace/notifications">All</Link>
        <Link className={unreadOnly ? "font-medium text-ink" : "text-ink-soft"} href="/workspace/notifications?view=unread">Unread</Link>
      </nav>
      {all.length === 0 ? <EmptyState title="You are caught up" body="Friend requests, messages, grades, and announcements land here when you allow them in Settings." /> : null}
      {all.length > 0 && notes.length === 0 ? <p className="text-sm text-ink-soft">Nothing unread.</p> : null}
      <NoteGroup title="Courses" notes={notes.filter((note) => note.href?.includes("/workspace/learn"))} />
      <NoteGroup title="People and campus" notes={notes.filter((note) => !note.href?.includes("/workspace/learn"))} />
    </div>
  );
}

function NoteGroup({
  title,
  notes,
}: {
  title: string;
  notes: Awaited<ReturnType<typeof listNotifications>>;
}) {
  if (notes.length === 0) {
    return null;
  }
  return (
    <section aria-label={title} className="grid gap-4">
      <h2 className="font-display text-2xl">{title}</h2>
      {notes.map((note) => (
        <Card key={note.id}>
          <CardTitle>{note.title}</CardTitle>
          <CardText>
            {note.body}
            {note.readAt ? " · read" : " · new"}
            {" · "}
            {age(note.createdAt)}
          </CardText>
          <div className="mt-3 flex gap-3">
            {note.href ? (
              <Link className="text-sm text-pine underline-offset-4 hover:underline" href={note.href}>
                Open
              </Link>
            ) : null}
            {!note.readAt ? (
              <form action={markNotificationReadAction}>
                <input type="hidden" name="id" value={note.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Mark read
                </Button>
              </form>
            ) : null}
          </div>
        </Card>
      ))}
    </section>
  );
}

function age(date: Date) {
  const hours = (Date.now() - date.getTime()) / 3_600_000;
  if (hours < 1) {
    return "Just now";
  }
  if (hours < 24) {
    const whole = Math.max(1, Math.floor(hours));
    return `${whole} hour${whole === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
