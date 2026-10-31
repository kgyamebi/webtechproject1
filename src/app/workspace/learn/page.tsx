import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { createCourseAction, joinCourseAction, listCourses } from "@/server/academic/actions";

export const metadata = { title: "Learn" };

export default async function LearnPage() {
  const { teaching, studying, samples } = await listCourses();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Learn</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Lecturers create a course and share a join code. Students join with that code or are enrolled by email. A domain
          match on your account does not enrol you by itself.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Join with a code</CardTitle>
          <form action={joinCourseAction} className="mt-4 grid gap-3">
            <Field label="Join code" name="joinCode">
              <Input id="joinCode" name="joinCode" required autoCapitalize="characters" />
            </Field>
            <Button type="submit">Join course</Button>
          </form>
        </Card>
        <Card>
          <CardTitle>Create a course</CardTitle>
          <CardText>Only a lecturer or platform administrator can create one.</CardText>
          <form action={createCourseAction} className="mt-4 grid gap-3">
            <Field label="Code" name="code">
              <Input id="code" name="code" required minLength={2} placeholder="CS101" />
            </Field>
            <Field label="Title" name="title">
              <Input id="title" name="title" required minLength={2} />
            </Field>
            <Field label="Description" name="description">
              <Textarea id="description" name="description" />
            </Field>
            <Button type="submit">Create</Button>
          </form>
        </Card>
      </div>
      <section>
        <h2 className="font-display text-xl">Teaching</h2>
        {teaching.length === 0 ? <EmptyState title="You are not teaching a course" body="Create one if you are a lecturer." /> : null}
        {teaching.map((course) => (
          <CourseRow
            key={course.id}
            href={`/workspace/learn/${course.id}`}
            action="Open course"
            code={course.code}
            title={course.title}
            detail={`${course._count.enrollments} students · join code ${course.joinCode}${course.source === "SIMULATED" ? ` · ${course.sourceLabel}` : ""}${course.archived ? " · archived" : ""}`}
          />
        ))}
      </section>
      <section>
        <h2 className="font-display text-xl">Studying</h2>
        {studying.length === 0 ? <EmptyState title="No courses yet" body="Ask a lecturer for a join code." /> : null}
        {studying.map((course) => (
          <CourseRow
            key={course.id}
            href={`/workspace/learn/${course.id}`}
            action="Open course"
            code={course.code}
            title={course.title}
            detail={[course.description, progressLine(course)].filter(Boolean).join(" · ")}
          />
        ))}
      </section>
      <section>
        <h2 className="font-display text-xl">Sample imports</h2>
        {samples.length === 0 ? (
          <EmptyState title="No simulated import" body="The LMS page can create a labelled sample course. It is not a live Canvas connection." />
        ) : null}
        {samples.map((course) => (
          <CourseRow
            key={course.id}
            href={`/workspace/learn/${course.id}`}
            action="Open sample"
            code={course.code}
            title={course.title}
            detail={[course.sourceLabel, progressLine(course)].filter(Boolean).join(" · ")}
          />
        ))}
      </section>
    </div>
  );
}

function CourseRow({
  href,
  action,
  code,
  title,
  detail,
}: {
  href: string;
  action: string;
  code: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid items-baseline gap-2 border-t border-line py-4 sm:grid-cols-[5.5rem_1fr_auto] sm:gap-4">
      <p className="text-xs tracking-wide text-brass">{code}</p>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-soft">{detail}</p>
      </div>
      <Link href={href} className="text-sm text-ink underline-offset-4 hover:underline">
        {action}
      </Link>
    </div>
  );
}

function progressLine(course: {
  modules: Array<{ materials: Array<{ completions: unknown[] }> }>;
  assignments: Array<{ submissions: unknown[] }>;
}) {
  const materials = course.modules.flatMap((module) => module.materials);
  const done = materials.filter((material) => material.completions.length > 0).length;
  const submitted = course.assignments.filter((assignment) => assignment.submissions.length > 0).length;
  const parts = [];
  if (materials.length > 0) {
    parts.push(`${done} of ${materials.length} material${materials.length === 1 ? "" : "s"} done`);
  }
  if (course.assignments.length > 0) {
    parts.push(`${submitted} of ${course.assignments.length} assignment${course.assignments.length === 1 ? "" : "s"} submitted`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No published materials or assignments yet.";
}
