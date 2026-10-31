import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  addCategoryAction,
  addMaterialAction,
  addModuleAction,
  announceAction,
  archiveCourseAction,
  completeMaterialAction,
  createAssignmentAction,
  createQuizAction,
  createStudyGroupAction,
  enrollStudentAction,
  joinStudyGroupAction,
  loadCourse,
  setModuleGateAction,
} from "@/server/academic/actions";
import { StudioNav } from "@/components/academic/studio-nav";
import { createPostAction } from "@/server/social/actions";
import { submissionAccepted } from "@/server/academic/rules";

export const metadata = { title: "Course" };

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const loaded = await loadCourse(courseId);
  if (!loaded) {
    notFound();
  }
  const { course, isStaff, viewerId } = loaded;
  const now = new Date();
  const teachers = course.staff.map((member) => member.user.name);

  return (
    <div className="grid gap-6">
      <div>
        <p className="kicker">{course.code}</p>
        <h1 className="stage-title mt-3 max-w-3xl">{course.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-soft">{course.description}</p>
        {teachers.length > 0 ? <p className="mt-3 text-sm text-ink">Taught by {teachers.join(", ")}.</p> : null}
        <CourseProgress course={course} />
        <NextStep course={course} isStaff={isStaff} now={now} />
        <RemainingWork course={course} isStaff={isStaff} now={now} />
        <nav aria-label="Course sections" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a className="text-ink-soft underline-offset-4 hover:text-ink hover:underline" href="#modules">Modules</a>
          <a className="text-ink-soft underline-offset-4 hover:text-ink hover:underline" href="#assignments">Assignments</a>
          <a className="text-ink-soft underline-offset-4 hover:text-ink hover:underline" href="#quizzes">Quizzes</a>
          <a className="text-ink-soft underline-offset-4 hover:text-ink hover:underline" href="#announcements">Announcements</a>
          <Link className="text-ink-soft underline-offset-4 hover:text-ink hover:underline" href={`/workspace/learn/${course.id}/grades`}>Grades</Link>
        </nav>
        <StudioNav courseId={course.id} />
        {course.source === "SIMULATED" ? (
          <p className="mt-2 text-sm text-coral">{course.sourceLabel || "Simulated import. This is not a live LMS course."}</p>
        ) : null}
        {isStaff ? <p className="mt-2 text-sm">Join code: {course.joinCode}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="text-pine underline-offset-4 hover:underline" href={`/workspace/learn/${course.id}/grades`}>
          Gradebook
        </Link>
      </div>
      {isStaff ? (
        <Card>
          <CardTitle>Course tools</CardTitle>
          <form action={enrollStudentAction} className="mt-4 grid gap-3">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Enrol a student by email" name="email">
              <Input id="email" name="email" type="email" required />
            </Field>
            <Button type="submit">Enrol</Button>
          </form>
          <form action={archiveCourseAction} className="mt-4">
            <input type="hidden" name="courseId" value={course.id} />
            <Button type="submit" variant="secondary">
              {course.archived ? "Restore course" : "Archive course"}
            </Button>
          </form>
        </Card>
      ) : null}
      <section className="grid gap-3">
        <h2 id="modules" className="font-display text-2xl">Modules</h2>
        {course.modules.map((module, index) => {
          const previous = course.modules[index - 1];
          const locked =
            !isStaff &&
            module.gate &&
            Boolean(previous && previous.materials.length > 0 && previous.materials.some((item) => item.completions.length === 0));
          return (
          <Card key={module.id}>
            <CardTitle>{module.title}</CardTitle>
            {module.gate ? <CardText>This module waits until the previous one is finished.</CardText> : null}
            {locked ? <p className="mt-3 text-sm text-ink-soft">Finish {previous?.title} first.</p> : (
            <ul className="mt-3 grid gap-2 text-sm">
              {module.materials.map((material) => (
                <li key={material.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {material.url ? (
                      <a href={material.url} className="text-pine underline-offset-4 hover:underline">
                        {material.title}
                      </a>
                    ) : (
                      material.title
                    )}
                    {material.completions.length > 0 ? " · done" : ""}
                  </span>
                  <form action={completeMaterialAction}>
                    <input type="hidden" name="materialId" value={material.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Mark done
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
            )}
            {isStaff ? (
              <form action={setModuleGateAction} className="mt-4">
                <input type="hidden" name="moduleId" value={module.id} />
                <input type="hidden" name="gate" value={module.gate ? "off" : "on"} />
                <Button type="submit" size="sm" variant="secondary">{module.gate ? "Remove the gate" : "Gate this module"}</Button>
              </form>
            ) : null}
            {isStaff ? (
              <form action={addMaterialAction} className="mt-4 grid gap-2">
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="moduleId" value={module.id} />
                <Input name="title" placeholder="Material title" aria-label="Material title" required />
                <Input name="url" placeholder="https://" aria-label="Material link" />
                <Button type="submit" size="sm">
                  Add material
                </Button>
              </form>
            ) : null}
          </Card>
          );
        })}
        {isStaff ? (
          <form action={addModuleAction} className="grid gap-2">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="New module" name="title">
              <Input id="title" name="title" required minLength={2} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="gate" /> Wait until the previous module is finished
            </label>
            <Button type="submit">Add module</Button>
          </form>
        ) : null}
      </section>
      <section className="grid gap-3">
        <h2 id="assignments" className="font-display text-2xl">Assignments</h2>
        {course.assignments.map((assignment) => (
          <Card key={assignment.id}>
            <CardTitle>{assignment.title}</CardTitle>
            <CardText>{assignmentLine(assignment, isStaff, now)}</CardText>
            <Link className="text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/learn/${course.id}/assignments/${assignment.id}`}>
              Open
            </Link>
          </Card>
        ))}
        {isStaff ? (
          <Card>
            <form action={createAssignmentAction} className="grid gap-3">
              <input type="hidden" name="courseId" value={course.id} />
              <Field label="Assignment title" name="title">
                <Input id="assignment-title" name="title" required />
              </Field>
              <Field label="Instructions" name="instructions">
                <Textarea id="instructions" name="instructions" />
              </Field>
              <Field label="Due" name="dueAt">
                <Input id="dueAt" name="dueAt" type="datetime-local" required />
              </Field>
              <Field label="Points" name="maxPoints">
                <Input id="maxPoints" name="maxPoints" type="number" min={1} defaultValue={100} />
              </Field>
              <Field label="Category" name="categoryId">
                <Select id="categoryId" name="categoryId" defaultValue="">
                  <option value="">None</option>
                  {course.gradeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="published" /> Publish now
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="allowLate" /> Allow late submissions
              </label>
              <Button type="submit">Create assignment</Button>
            </form>
          </Card>
        ) : null}
      </section>
      <section className="grid gap-3">
        <h2 id="quizzes" className="font-display text-2xl">Quizzes</h2>
        {course.quizzes.map((quiz) => (
          <Card key={quiz.id}>
            <CardTitle>{quiz.title}</CardTitle>
            <CardText>{quizLine(quiz, isStaff)}</CardText>
            <Link className="text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/learn/${course.id}/quizzes/${quiz.id}`}>
              Open
            </Link>
          </Card>
        ))}
        {isStaff ? (
          <form action={createQuizAction} className="grid gap-3">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Quiz title" name="title">
              <Input id="quiz-title" name="title" required />
            </Field>
            <Field label="Attempt limit" name="attemptLimit">
              <Input id="attemptLimit" name="attemptLimit" type="number" min={1} defaultValue={1} />
            </Field>
            <Field label="Time limit in minutes" name="timeLimitMinutes">
              <Input id="timeLimitMinutes" name="timeLimitMinutes" type="number" min={1} />
            </Field>
            <Button type="submit">Create quiz</Button>
          </form>
        ) : null}
      </section>
      <section className="grid gap-3">
        <h2 id="announcements" className="font-display text-2xl">Announcements</h2>
        {course.announcements.map((item) => (
          <Card key={item.id}>
            <CardTitle>{item.title}</CardTitle>
            <CardText>
              {postedAgo(item.createdAt, now)} · {item.body}
            </CardText>
          </Card>
        ))}
        {isStaff ? (
          <form action={announceAction} className="grid gap-3">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Announcement title" name="announce-title">
              <Input id="announce-title" name="title" required />
            </Field>
            <Field label="Announcement" name="announce-body">
              <Textarea id="announce-body" name="body" required />
            </Field>
            <Button type="submit">Post announcement</Button>
          </form>
        ) : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Study groups</h2>
        {course.studyGroups.map((group) => (
          <Card key={group.id}>
            <CardTitle>{group.name}</CardTitle>
            <CardText>{group.members.length} {group.members.length === 1 ? "member" : "members"}{group.members.some((member) => member.userId === viewerId) ? " · you are in this group" : ""}</CardText>
            {group.members.some((member) => member.userId === viewerId) ? null : (
              <form action={joinStudyGroupAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Join
                </Button>
              </form>
            )}
          </Card>
        ))}
        <form action={createStudyGroupAction} className="grid gap-3">
          <input type="hidden" name="courseId" value={course.id} />
          <Field label="New study group" name="group-name">
            <Input id="group-name" name="name" required minLength={2} />
          </Field>
          <Button type="submit">Create group</Button>
        </form>
      </section>
      {isStaff ? (
        <Card>
          <CardTitle>Grade category</CardTitle>
          <form action={addCategoryAction} className="mt-4 grid gap-3">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Name" name="category-name">
              <Input id="category-name" name="name" required />
            </Field>
            <Field label="Weight" name="weight" hint="Weights are scaled across categories that already have released work.">
              <Input id="weight" name="weight" type="number" min={1} required />
            </Field>
            <Button type="submit">Save category</Button>
          </form>
          <p className="mt-3 text-sm text-ink-soft">{course.enrollments.length} enrolled students.</p>
        </Card>
      ) : null}
      <Card>
        <CardTitle>Course post</CardTitle>
        <form action={createPostAction} className="mt-4 grid gap-3">
          <input type="hidden" name="audience" value="COURSE" />
          <input type="hidden" name="courseId" value={course.id} />
          <Field label="Visible to this course" name="course-post">
            <Textarea id="course-post" name="body" required />
          </Field>
          <Button type="submit">Post</Button>
        </form>
      </Card>
    </div>
  );
}

function NextStep({
  course,
  isStaff,
  now,
}: {
  course: {
    id: string;
    modules: Array<{ title: string; gate: boolean; materials: Array<{ completions: unknown[] }> }>;
    assignments: Array<{ id: string; title: string; dueAt: Date; allowLate: boolean; submissions: unknown[] }>;
    quizzes: Array<{ id: string; title: string; published: boolean; attemptLimit: number; closeAt: Date | null; attempts: Array<{ status: string }> }>;
  };
  isStaff: boolean;
  now: Date;
}) {
  if (isStaff) {
    const hidden = course.assignments.reduce(
      (sum, assignment) => sum + assignment.submissions.filter((item) => !(item as { released?: boolean }).released).length,
      0,
    );
    return (
      <p className="mt-4 max-w-xl text-sm leading-6 text-ink">
        {hidden > 0
          ? `${hidden} submission${hidden === 1 ? "" : "s"} ${hidden === 1 ? "is" : "are"} still hidden from students.`
          : "Every submission on this course has a released grade, or none have been sent."}
      </p>
    );
  }

  for (let index = 0; index < course.modules.length; index += 1) {
    const module = course.modules[index];
    const previous = course.modules[index - 1];
    const locked =
      module.gate &&
      Boolean(previous && previous.materials.length > 0 && previous.materials.some((item) => item.completions.length === 0));
    if (locked && previous) {
      return <p className="mt-4 max-w-xl text-sm leading-6 text-ink">Next: finish {previous.title}. {module.title} stays closed until then.</p>;
    }
  }

  const openAssignment = course.assignments.find(
    (assignment) => assignment.submissions.length === 0 && submissionAccepted(now, assignment.dueAt, assignment.allowLate).ok,
  );
  if (openAssignment) {
    return (
      <p className="mt-4 max-w-xl text-sm leading-6 text-ink">
        Next:{" "}
        <Link className="underline underline-offset-4" href={`/workspace/learn/${course.id}/assignments/${openAssignment.id}`}>
          {openAssignment.title}
        </Link>{" "}
        is still open.
      </p>
    );
  }

  const openQuiz = course.quizzes.find((quiz) => {
    const used = quiz.attempts.filter((attempt) => attempt.status === "SUBMITTED").length;
    const closed = Boolean(quiz.closeAt && quiz.closeAt.getTime() < now.getTime());
    return quiz.published && used < quiz.attemptLimit && !closed;
  });
  if (openQuiz) {
    return (
      <p className="mt-4 max-w-xl text-sm leading-6 text-ink">
        Next:{" "}
        <Link className="underline underline-offset-4" href={`/workspace/learn/${course.id}/quizzes/${openQuiz.id}`}>
          {openQuiz.title}
        </Link>{" "}
        still has an attempt left.
      </p>
    );
  }

  return <p className="mt-4 max-w-xl text-sm leading-6 text-ink">Published work on this course is in. A grade appears only after it is released.</p>;
}

function RemainingWork({
  course,
  isStaff,
  now,
}: {
  course: {
    id: string;
    modules: Array<{ title: string; gate: boolean; materials: Array<{ id: string; title: string; completions: unknown[] }> }>;
    assignments: Array<{ id: string; title: string; dueAt: Date; allowLate: boolean; submissions: unknown[] }>;
    quizzes: Array<{ id: string; title: string; published: boolean; attemptLimit: number; closeAt: Date | null; attempts: Array<{ status: string }> }>;
  };
  isStaff: boolean;
  now: Date;
}) {
  if (isStaff) {
    return null;
  }
  const items: Array<{ id: string; href: string; label: string; detail: string }> = [];
  for (const module of course.modules) {
    for (const material of module.materials) {
      if (material.completions.length === 0) {
        items.push({ id: material.id, href: "#modules", label: material.title, detail: `Material · ${module.title}` });
      }
    }
  }
  for (const assignment of course.assignments) {
    if (assignment.submissions.length === 0) {
      const window = submissionAccepted(now, assignment.dueAt, assignment.allowLate);
      items.push({
        id: assignment.id,
        href: `/workspace/learn/${course.id}/assignments/${assignment.id}`,
        label: assignment.title,
        detail: window.ok ? (window.late ? "Assignment · late work still accepted" : "Assignment · still open") : "Assignment · closed",
      });
    }
  }
  for (const quiz of course.quizzes) {
    const used = quiz.attempts.filter((attempt) => attempt.status === "SUBMITTED").length;
    const closed = Boolean(quiz.closeAt && quiz.closeAt.getTime() < now.getTime());
    if (quiz.published && used < quiz.attemptLimit && !closed) {
      items.push({
        id: quiz.id,
        href: `/workspace/learn/${course.id}/quizzes/${quiz.id}`,
        label: quiz.title,
        detail: `Quiz · ${quiz.attemptLimit - used} attempt${quiz.attemptLimit - used === 1 ? "" : "s"} left`,
      });
    }
  }
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="mt-6 max-w-xl" aria-label="Still to do">
      <h2 className="font-display text-2xl">Still to do</h2>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <Link className="text-ink underline underline-offset-4" href={item.href}>
              {item.label}
            </Link>
            <span className="mt-0.5 block text-ink-soft">{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function assignmentLine(
  assignment: {
    dueAt: Date;
    maxPoints: number;
    published: boolean;
    allowLate: boolean;
    submissions: Array<{ points: number | null; released: boolean; late: boolean }>;
  },
  isStaff: boolean,
  now: Date,
) {
  const due = `Due ${assignment.dueAt.toLocaleString()} · ${assignment.maxPoints} points`;
  if (isStaff) {
    return `${due} · ${assignment.submissions.length} submitted${assignment.published ? "" : " · draft"}`;
  }
  const mine = assignment.submissions[0];
  if (!mine) {
    const window = submissionAccepted(now, assignment.dueAt, assignment.allowLate);
    return window.ok ? `${due}${window.late ? " · late work is still accepted" : ""}` : `${due} · closed, nothing submitted`;
  }
  if (mine.released && mine.points !== null) {
    return `${due} · ${mine.points} / ${assignment.maxPoints} released`;
  }
  return `${due} · submitted${mine.late ? " late" : ""}. The grade stays hidden until it is released.`;
}

function quizLine(
  quiz: {
    published: boolean;
    attemptLimit: number;
    closeAt: Date | null;
    pointsReleased: boolean;
    attempts: Array<{ status: string; score: number | null }>;
  },
  isStaff: boolean,
) {
  if (isStaff) {
    const submitted = quiz.attempts.filter((attempt) => attempt.status === "SUBMITTED").length;
    return `${quiz.published ? "Published" : "Draft"} · ${quiz.attemptLimit} attempt limit · ${submitted} submitted`;
  }
  const submitted = quiz.attempts.filter((attempt) => attempt.status === "SUBMITTED");
  const close = quiz.closeAt ? ` · closes ${quiz.closeAt.toLocaleString()}` : "";
  const score =
    submitted.length > 0 && quiz.pointsReleased && submitted[0]?.score !== null && submitted[0]?.score !== undefined
      ? ` · score ${submitted[0].score}`
      : submitted.length > 0
        ? " · the score stays hidden until it is released"
        : "";
  return `${submitted.length} of ${quiz.attemptLimit} attempts used${close}${score}`;
}

function CourseProgress({
  course,
}: {
  course: {
    modules: Array<{ materials: Array<{ completions: unknown[] }> }>;
    assignments: Array<{ submissions: unknown[] }>;
  };
}) {
  const materials = course.modules.flatMap((module) => module.materials);
  const done = materials.filter((material) => material.completions.length > 0).length;
  const submitted = course.assignments.filter((assignment) => assignment.submissions.length > 0).length;
  const total = materials.length + course.assignments.length;
  const finished = done + submitted;
  if (total === 0) {
    return null;
  }
  const percent = Math.round((finished / total) * 100);
  const parts = [`${finished} of ${total} finished`];
  if (materials.length > 0) {
    parts.push(`${done} of ${materials.length} materials`);
  }
  if (course.assignments.length > 0) {
    parts.push(`${submitted} of ${course.assignments.length} assignments`);
  }
  return (
    <div className="mt-6 max-w-md">
      <p className="text-sm text-ink-soft">{parts.join(" · ")}</p>
      <div className="mt-2 h-1 bg-line" aria-hidden="true">
        <div className="h-1 bg-ink" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function postedAgo(date: Date, now: Date) {
  const hours = (now.getTime() - date.getTime()) / 3_600_000;
  if (hours < 1) {
    return "Just now";
  }
  if (hours < 24) {
    const whole = Math.max(1, Math.floor(hours));
    return `${whole} hour${whole === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 14) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString();
}
