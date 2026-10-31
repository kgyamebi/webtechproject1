import Link from "next/link";
import { notFound } from "next/navigation";
import { WhatIf } from "@/components/academic/what-if";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { loadGrades } from "@/server/academic/actions";

export const metadata = { title: "Grades" };

export default async function GradesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const grades = await loadGrades(courseId);
  if (!grades) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <div>
        <Link className="text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>
          Back to course
        </Link>
        <h1 className="mt-2 font-display text-4xl">Gradebook</h1>
        <p className="mt-3">
          <a className="text-sm text-pine underline-offset-4 hover:underline" href={`/api/course-record/${courseId}`}>Download CSV</a>
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Students see a mark only after it is released. The CSV is the record of those marks for this course. Empty categories are left out and the remaining weights are scaled. This course is not fed by a university student-information system.
        </p>
      </div>
      {grades.courseTotal !== null ? (
        <Card>
          <CardTitle>Course total</CardTitle>
          <CardText>{grades.courseTotal}%</CardText>
        </Card>
      ) : null}
      {!grades.isStaff ? <WhatIf groups={grades.whatIf} /> : null}
      <Card>
        <CardTitle>Released work</CardTitle>
        <ul className="mt-3 grid gap-2 text-sm">
          {grades.records.map((record) => (
            <li key={record.id}>
              {record.title}: {record.points} / {record.maxPoints}
              {record.released ? "" : " · hidden from the student"}
              {record.feedback ? ` · ${record.feedback}` : ""}
            </li>
          ))}
          {grades.records.length === 0 ? <li className="text-ink-soft">Nothing has been released.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
