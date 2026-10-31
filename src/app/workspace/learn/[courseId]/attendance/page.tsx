import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { prisma } from "@/server/db/client";
import { addAttendanceAction, courseStudioAccess, markAllPresentAction, markAttendanceAction } from "@/server/academic/studio";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await courseStudioAccess(courseId);
  if (!access) {
    notFound();
  }
  const sessions = await prisma.attendanceSession.findMany({
    where: { courseId },
    orderBy: { heldAt: "desc" },
    include: { marks: true },
  });
  const students = access.isStaff
    ? await prisma.enrollment.findMany({
        where: { courseId },
        include: { user: { select: { id: true, name: true } } },
      })
    : [];

  return (
    <div>
      <Link className="text-sm text-ink underline-offset-4 hover:underline" href={`/workspace/learn/${courseId}`}>Back to course</Link>
      <h1 className="stage-title mt-4">Attendance</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">A session is a date the lecturer records. You see only your own mark. Excused is a recorded absence that does not count against you.</p>
      {!access.isStaff && sessions.length > 0 ? (
        <p className="mt-4 text-sm">
          {attendanceSummary(sessions.flatMap((session) => session.marks.filter((mark) => mark.studentId === access.viewer.userId).map((mark) => mark.status)))}
        </p>
      ) : null}
      <ul className="mt-6 max-w-2xl">
        {sessions.length === 0 ? <li className="text-sm text-ink-soft">No sessions yet.</li> : null}
        {sessions.map((session) => {
          const mine = session.marks.find((mark) => mark.studentId === access.viewer.userId);
          return (
            <li key={session.id} className="border-t border-line py-4 text-sm">
              <p className="font-medium">{session.title}</p>
              <p className="text-ink-soft">{session.heldAt.toLocaleString()} · {access.isStaff ? `${session.marks.length} marked` : statusLabel(mine?.status)}</p>
              {access.isStaff ? (
                <form action={markAllPresentAction} className="mt-3">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Button type="submit" size="sm" variant="secondary">Mark everyone present</Button>
                </form>
              ) : null}
              {access.isStaff ? students.map((student) => {
                const mark = session.marks.find((item) => item.studentId === student.userId);
                return (
                  <form key={student.userId} action={markAttendanceAction} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="studentId" value={student.userId} />
                    <p className="w-40 text-sm">{student.user.name}</p>
                    <Select name="status" defaultValue={mark?.status ?? "PRESENT"} aria-label={`Status for ${student.user.name}`}>
                      <option value="PRESENT">Present</option>
                      <option value="LATE">Late</option>
                      <option value="ABSENT">Absent</option>
                      <option value="EXCUSED">Excused</option>
                    </Select>
                    <Button type="submit" size="sm" variant="secondary">Save</Button>
                  </form>
                );
              }) : null}
            </li>
          );
        })}
      </ul>
      {access.isStaff ? (
        <form action={addAttendanceAction} className="mt-8 grid max-w-md gap-3">
          <h2 className="font-display text-xl">New session</h2>
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Title" name="attendance-title"><Input id="attendance-title" name="title" required minLength={2} /></Field>
          <Field label="When" name="attendance-when"><Input id="attendance-when" name="heldAt" type="datetime-local" required /></Field>
          <Button type="submit">Add session</Button>
        </form>
      ) : null}
    </div>
  );
}

function statusLabel(status: string | undefined) {
  if (status === "PRESENT") return "Present";
  if (status === "LATE") return "Late";
  if (status === "ABSENT") return "Absent";
  if (status === "EXCUSED") return "Excused";
  return "Not marked";
}

function attendanceSummary(statuses: string[]) {
  const count = (status: string) => statuses.filter((item) => item === status).length;
  const counted = statuses.length - count("EXCUSED");
  const attended = count("PRESENT") + count("LATE");
  const percent = counted > 0 ? ` · ${Math.round((attended / counted) * 100)}% attended` : "";
  return `Present ${count("PRESENT")} · Late ${count("LATE")} · Absent ${count("ABSENT")} · Excused ${count("EXCUSED")}${percent}`;
}
