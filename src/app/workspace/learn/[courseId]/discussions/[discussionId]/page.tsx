import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { courseStudioAccess, discussionStateAction, gradeDiscussionAction, replyDiscussionAction } from "@/server/academic/studio";

export const metadata = { title: "Discussion" };

export default async function DiscussionPage({
  params,
}: {
  params: Promise<{ courseId: string; discussionId: string }>;
}) {
  const { courseId, discussionId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const discussion = await prisma.discussion.findUnique({
    where: { id: discussionId },
    include: {
      posts: { orderBy: { createdAt: "asc" } },
      grades: true,
    },
  });
  if (!discussion || discussion.courseId !== courseId) {
    notFound();
  }
  const mine = discussion.grades.find((grade) => grade.studentId === access.viewer.userId && grade.released);
  const roots = discussion.posts.filter((post) => !post.parentId);
  const roster = access.isStaff
    ? await prisma.enrollment.findMany({
        where: { courseId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: "asc" } },
      })
    : [];

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}/discussions`}>All discussions</Link>
      <h1 className="stage-title mt-4">{discussion.title}</h1>
      <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-7">{discussion.body}</p>
      <p className="mt-2 text-sm text-ink-soft">
        {discussion.closed ? "Closed" : "Open"}
        {discussion.points ? ` · ${discussion.points} points` : ""}
        {mine ? ` · Your released grade is ${mine.points}` : ""}
      </p>
      {access.isStaff ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={discussionStateAction}>
            <input type="hidden" name="discussionId" value={discussion.id} />
            <input type="hidden" name="state" value={discussion.pinned ? "unpin" : "pin"} />
            <Button type="submit" variant="secondary" size="sm">{discussion.pinned ? "Unpin" : "Pin"}</Button>
          </form>
          <form action={discussionStateAction}>
            <input type="hidden" name="discussionId" value={discussion.id} />
            <input type="hidden" name="state" value={discussion.closed ? "open" : "close"} />
            <Button type="submit" variant="secondary" size="sm">{discussion.closed ? "Reopen" : "Close"}</Button>
          </form>
        </div>
      ) : null}
      <ul className="mt-8 max-w-2xl">
        {roots.map((post) => (
          <li key={post.id} className="border-t border-line py-4 text-sm">
            <p className="font-medium">{post.authorName}</p>
            <p className="mt-1 whitespace-pre-wrap leading-6">{post.body}</p>
            <ul className="mt-3 grid gap-3 border-l border-line pl-4">
              {discussion.posts.filter((reply) => reply.parentId === post.id).map((reply) => (
                <li key={reply.id}>
                  <p className="font-medium">{reply.authorName}</p>
                  <p className="mt-1 whitespace-pre-wrap leading-6">{reply.body}</p>
                </li>
              ))}
            </ul>
            {!discussion.closed ? (
              <form action={replyDiscussionAction} className="mt-3 grid gap-2">
                <input type="hidden" name="discussionId" value={discussion.id} />
                <input type="hidden" name="parentId" value={post.id} />
                <Field label={`Reply to ${post.authorName}`} name={`reply-${post.id}`}>
                  <Textarea id={`reply-${post.id}`} name="body" required />
                </Field>
                <Button type="submit" size="sm" variant="secondary">Reply</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {!discussion.closed ? (
        <form action={replyDiscussionAction} className="mt-6 grid max-w-xl gap-3">
          <input type="hidden" name="discussionId" value={discussion.id} />
          <Field label="New post" name="discussion-post"><Textarea id="discussion-post" name="body" required /></Field>
          <Button type="submit">Post</Button>
        </form>
      ) : null}
      {access.isStaff && discussion.points ? (
        <form action={gradeDiscussionAction} className="mt-8 grid max-w-md gap-3">
          <h2 className="font-display text-xl">Release a grade</h2>
          <p className="text-sm leading-6 text-ink-soft">Pick a student who is enrolled. The grade is released immediately and copied to email when mail can be sent.</p>
          <input type="hidden" name="discussionId" value={discussion.id} />
          <Field label="Student" name="grade-student">
            <Select name="studentId" required defaultValue="">
              <option value="" disabled>Choose a student</option>
              {roster.map((student) => {
                const released = discussion.grades.find((grade) => grade.studentId === student.userId && grade.released);
                return (
                  <option key={student.userId} value={student.userId}>
                    {student.user.name}{released ? ` · ${released.points} released` : ""}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Points" name="grade-points"><Input id="grade-points" name="points" type="number" min={0} max={discussion.points} required /></Field>
          <Button type="submit" variant="secondary">Release grade</Button>
        </form>
      ) : null}
    </div>
  );
}
