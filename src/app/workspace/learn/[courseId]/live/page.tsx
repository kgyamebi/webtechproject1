import Link from "next/link";
import { notFound } from "next/navigation";
import { CallAvailability } from "@/components/call/call-availability";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { courseStudioAccess, postLiveMessageAction } from "@/server/academic/studio";

export const metadata = { title: "Live room" };

export default async function LiveRoomPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const messages = await prisma.courseLiveMessage.findMany({
    where: { courseId },
    orderBy: { createdAt: "asc" },
    take: 80,
  });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Live room</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        This room is text for people in the course, and the transcript stays here. It updates when you send.
      </p>
      <CallAvailability scope="course" id={courseId} open appearance="desk" />
      <ul className="mt-6 max-w-2xl">
        {messages.length === 0 ? <li className="text-sm text-ink-soft">No messages yet. The first post opens the room.</li> : null}
        {messages.map((message) => (
          <li key={message.id} className="border-t border-line py-3 text-sm">
            <p className="font-medium">
              {message.authorName}
              <span className="ml-2 text-xs font-normal text-ink-soft">{message.createdAt.toLocaleString()}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-6">{message.body}</p>
          </li>
        ))}
      </ul>
      <form action={postLiveMessageAction} className="mt-6 grid max-w-xl gap-3">
        <input type="hidden" name="courseId" value={courseId} />
        <Field label="Message" name="live-message"><Textarea id="live-message" name="body" required /></Field>
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
