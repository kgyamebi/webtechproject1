import Link from "next/link";
import { notFound } from "next/navigation";
import { Prose } from "@/components/academic/prose";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { courseStudioAccess, saveSyllabusAction } from "@/server/academic/studio";

export const metadata = { title: "Syllabus" };

export default async function SyllabusPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const assignments = await prisma.assignment.findMany({
    where: { courseId, published: true },
    orderBy: { dueAt: "asc" },
    select: { id: true, title: true, dueAt: true },
  });
  const quizzes = await prisma.quiz.findMany({
    where: { courseId, published: true },
    orderBy: { closeAt: "asc" },
    select: { id: true, title: true, closeAt: true },
  });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <p className="kicker mt-4">{access.course.code}</p>
      <h1 className="stage-title mt-2">Syllabus</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        The written agreement sits above the work that is actually published. A line that starts with # becomes a heading.
      </p>
      {access.course.syllabus ? (
        <article className="mt-8 max-w-2xl">
          <Prose text={access.course.syllabus} />
        </article>
      ) : (
        <p className="mt-6 max-w-xl text-sm leading-6 text-ink-soft">
          No syllabus yet. When a lecturer writes one, it stays on this page instead of being buried in a file.
        </p>
      )}
      <section className="mt-10 max-w-2xl">
        <h2 className="font-display text-xl">Published work</h2>
        <ul className="mt-3">
          {assignments.length === 0 && quizzes.length === 0 ? <li className="text-sm text-ink-soft">Nothing published yet.</li> : null}
          {assignments.map((item) => (
            <li key={item.id} className="border-t border-line py-3 text-sm">
              <Link className="font-medium text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}/assignments/${item.id}`}>{item.title}</Link>
              <span className="mt-0.5 block text-ink-soft">Assignment · due {item.dueAt.toLocaleString()}</span>
            </li>
          ))}
          {quizzes.map((item) => (
            <li key={item.id} className="border-t border-line py-3 text-sm">
              <Link className="font-medium text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}/quizzes/${item.id}`}>{item.title}</Link>
              <span className="mt-0.5 block text-ink-soft">{item.closeAt ? `Quiz · closes ${item.closeAt.toLocaleString()}` : "Quiz · no close time"}</span>
            </li>
          ))}
        </ul>
      </section>
      {access.isStaff ? (
        <form action={saveSyllabusAction} className="mt-8 grid max-w-2xl gap-3">
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Syllabus" name="syllabus" hint="Start a line with # for a section, or ## for a smaller heading. Leave a blank line between sections.">
            <Textarea id="syllabus" name="syllabus" defaultValue={access.course.syllabus} />
          </Field>
          <Button type="submit">Save syllabus</Button>
        </form>
      ) : null}
    </div>
  );
}
