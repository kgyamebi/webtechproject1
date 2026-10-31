import { NextResponse } from "next/server";
import { loadGrades } from "@/server/academic/actions";

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const grades = await loadGrades(courseId);
  if (!grades) {
    return new NextResponse("Not found", { status: 404 });
  }
  const lines = ["Title,Points,Out of,Released"];
  for (const record of grades.records) {
    lines.push([cell(record.title), cell(record.points), cell(record.maxPoints), cell(record.released ? "yes" : "no")].join(","));
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"course-record.csv\"",
      "cache-control": "no-store",
    },
  });
}

function cell(value: string | number | boolean) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}
