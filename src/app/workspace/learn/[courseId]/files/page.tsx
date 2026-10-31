import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { addCourseFileAction, courseStudioAccess } from "@/server/academic/studio";

export const metadata = { title: "Files" };

export default async function FilesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const files = await prisma.courseFile.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Files</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">JPEG, PNG, WebP, or PDF under 2 MB. Each file stays inside this course.</p>
      <ul className="mt-6 max-w-2xl">
        {files.length === 0 ? <li className="text-sm text-ink-soft">No files yet.</li> : null}
        {files.map((file) => (
          <li key={file.id} className="flex items-baseline justify-between gap-4 border-t border-line py-3 text-sm">
            <span>
              {file.title}
              <span className="mt-0.5 block text-ink-soft">{file.createdAt.toLocaleDateString()}</span>
            </span>
            <a className="text-ink underline-offset-4 hover:underline" href={`/api/media/course-file/${file.id}`}>Open</a>
          </li>
        ))}
      </ul>
      {access.isStaff ? (
        <form action={addCourseFileAction} className="mt-8 grid max-w-md gap-3">
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Title" name="file-title"><Input id="file-title" name="title" required minLength={2} /></Field>
          <Field label="File" name="course-file"><input id="course-file" name="file" type="file" required className="text-sm" /></Field>
          <Button type="submit">Upload</Button>
        </form>
      ) : null}
    </div>
  );
}
