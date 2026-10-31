import Link from "next/link";
import { notFound } from "next/navigation";
import { Prose } from "@/components/academic/prose";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { addPageAction, courseStudioAccess } from "@/server/academic/studio";

export const metadata = { title: "Pages" };

export default async function PagesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const pages = await prisma.coursePage.findMany({ where: { courseId }, orderBy: { position: "asc" } });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Pages</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">Written course pages. A page is text in the course, not a file you have to download.</p>
      {pages.length === 0 ? <p className="mt-6 text-sm text-ink-soft">No pages yet.</p> : null}
      {pages.map((page, index) => (
        <article key={page.id} className="mt-8 max-w-2xl border-t border-line pt-4">
          <p className="kicker">Page {index + 1}</p>
          <h2 className="mt-2 font-display text-2xl">{page.title}</h2>
          <div className="mt-3">{page.body ? <Prose text={page.body} /> : <p className="text-sm text-ink-soft">This page has a title and no body yet.</p>}</div>
        </article>
      ))}
      {access.isStaff ? (
        <form action={addPageAction} className="mt-10 grid max-w-2xl gap-3">
          <h2 className="font-display text-xl">New page</h2>
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Title" name="page-title"><Input id="page-title" name="title" required minLength={2} /></Field>
          <Field label="Body" name="page-body" hint="A line starting with # becomes a heading."><Textarea id="page-body" name="body" /></Field>
          <Button type="submit">Publish page</Button>
        </form>
      ) : null}
    </div>
  );
}
