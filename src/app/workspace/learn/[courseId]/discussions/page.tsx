import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { courseStudioAccess, createDiscussionAction } from "@/server/academic/studio";

export const metadata = { title: "Discussions" };

export default async function DiscussionsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const discussions = await prisma.discussion.findMany({
    where: { courseId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { posts: true } },
      posts: { where: { authorId: access.viewer.userId }, select: { id: true }, take: 1 },
    },
  });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Discussions</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">Threads can be pinned or closed. A lecturer can attach points and release a grade. This is course writing, separate from the campus feed.</p>
      <ul className="mt-6 max-w-2xl">
        {discussions.length === 0 ? <li className="text-sm text-ink-soft">No discussions yet.</li> : null}
        {discussions.map((discussion) => (
          <li key={discussion.id} className="border-t border-line py-3 text-sm">
            <Link className="font-medium text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}/discussions/${discussion.id}`}>{discussion.title}</Link>
            <p className="text-ink-soft">
              {discussion.pinned ? "Pinned · " : ""}
              {discussion.closed ? "Closed · " : "Open · "}
              {discussion.posts.length > 0 ? "You replied · " : ""}
              {discussion._count.posts === 0 ? "No replies · " : `${discussion._count.posts} ${discussion._count.posts === 1 ? "reply" : "replies"} · `}
              {discussion.points ? `${discussion.points} points` : "Not graded"}
            </p>
          </li>
        ))}
      </ul>
      {access.isStaff ? (
        <form action={createDiscussionAction} className="mt-8 grid max-w-xl gap-3">
          <h2 className="font-display text-xl">New discussion</h2>
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Title" name="discussion-title"><Input id="discussion-title" name="title" required minLength={2} /></Field>
          <Field label="Prompt" name="discussion-body"><Textarea id="discussion-body" name="body" /></Field>
          <Field label="Points" name="discussion-points" hint="Leave blank if this thread is not graded."><Input id="discussion-points" name="points" type="number" min={1} /></Field>
          <Button type="submit">Open discussion</Button>
        </form>
      ) : null}
    </div>
  );
}
