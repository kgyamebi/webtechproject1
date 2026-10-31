import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { addToolAction, courseStudioAccess } from "@/server/academic/studio";

export const metadata = { title: "Tools" };

export default async function ToolsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const tools = await prisma.courseTool.findMany({ where: { courseId }, orderBy: { name: "asc" } });

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Tools</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        A tool is a link the lecturer added. Opening it leaves Campus+. Bring any result back to the assignment yourself. Campus+ does not fetch a score from that site, and it does not connect to Turnitin.
      </p>
      <ul className="mt-6 max-w-2xl">
        {tools.length === 0 ? <li className="text-sm text-ink-soft">No tools yet.</li> : null}
        {tools.map((tool) => (
          <li key={tool.id} className="border-t border-line py-3 text-sm">
            <p className="font-medium text-ink">{tool.name}</p>
            <p className="text-ink-soft">{toolHost(tool.url)} · no score comes back</p>
            <a className="mt-1 inline-block text-ink underline-offset-4 hover:underline" href={tool.url} target="_blank" rel="noreferrer">Open {tool.name} outside Campus+</a>
          </li>
        ))}
      </ul>
      {access.isStaff ? (
        <form action={addToolAction} className="mt-8 grid max-w-md gap-3">
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Name" name="tool-name"><Input id="tool-name" name="name" required minLength={2} /></Field>
          <Field label="URL" name="tool-url"><Input id="tool-url" name="url" type="url" required placeholder="https://" /></Field>
          <Button type="submit">Add tool</Button>
        </form>
      ) : null}
    </div>
  );
}

function toolHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
