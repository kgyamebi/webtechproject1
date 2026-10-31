"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db/client";
import { saveUpload } from "@/server/media/storage";
import { notifyUser } from "@/server/notifications";
import { safeHttpUrl } from "@/server/academic/rules";

function refresh(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function courseStudio(courseId: string) {
  const viewer = await requireUser();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      staff: { where: { userId: viewer.userId } },
      enrollments: { where: { userId: viewer.userId } },
    },
  });
  if (!course) {
    return null;
  }
  const isStaff = course.staff.length > 0;
  const enrolled = course.enrollments.length > 0;
  if (!isStaff && !enrolled) {
    return null;
  }
  return { course, isStaff, enrolled, viewer };
}

export async function saveSyllabusAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseStudio(courseId);
  if (!access?.isStaff) {
    return;
  }
  await prisma.course.update({
    where: { id: courseId },
    data: { syllabus: String(formData.get("syllabus") ?? "").slice(0, 20000) },
  });
  refresh([`/workspace/learn/${courseId}`, `/workspace/learn/${courseId}/syllabus`]);
  void viewer;
}

export async function addPageAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseStudio(courseId);
  if (!access?.isStaff) {
    return;
  }
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) {
    return;
  }
  const count = await prisma.coursePage.count({ where: { courseId } });
  await prisma.coursePage.create({
    data: {
      courseId,
      title,
      body: String(formData.get("body") ?? "").slice(0, 20000),
      position: count + 1,
    },
  });
  refresh([`/workspace/learn/${courseId}/pages`]);
}

export async function addCourseFileAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseStudio(courseId);
  if (!access?.isStaff) {
    return;
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }
  const path = await saveUpload(viewer.userId, new Uint8Array(await file.arrayBuffer()));
  await prisma.courseFile.create({
    data: {
      courseId,
      title: String(formData.get("title") ?? file.name).slice(0, 120) || file.name,
      filePath: path,
      uploadedById: viewer.userId,
    },
  });
  refresh([`/workspace/learn/${courseId}/files`]);
}

export async function addRubricCriterionAction(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    return;
  }
  const access = await courseStudio(assignment.courseId);
  if (!access?.isStaff) {
    return;
  }
  const title = String(formData.get("title") ?? "").trim();
  const points = Number(formData.get("points"));
  if (title.length < 2 || !Number.isInteger(points) || points < 1 || points > 1000) {
    return;
  }
  const count = await prisma.rubricCriterion.count({ where: { assignmentId } });
  await prisma.rubricCriterion.create({
    data: { assignmentId, title, points, position: count + 1 },
  });
  refresh([`/workspace/learn/${assignment.courseId}/assignments/${assignmentId}`]);
}

export async function addRubricLevelAction(formData: FormData) {
  const criterionId = String(formData.get("criterionId") ?? "");
  const criterion = await prisma.rubricCriterion.findUnique({ where: { id: criterionId }, include: { assignment: true } });
  if (!criterion) {
    return;
  }
  const access = await courseStudio(criterion.assignment.courseId);
  const label = String(formData.get("label") ?? "").trim();
  const points = Number(formData.get("points"));
  if (!access?.isStaff || label.length < 2 || !Number.isInteger(points) || points < 0 || points > criterion.points) {
    return;
  }
  const count = await prisma.rubricLevel.count({ where: { criterionId } });
  await prisma.rubricLevel.create({
    data: {
      criterionId,
      label,
      description: String(formData.get("description") ?? "").slice(0, 400),
      points,
      position: count + 1,
    },
  });
  refresh([`/workspace/learn/${criterion.assignment.courseId}/assignments/${criterion.assignmentId}`]);
}

export async function markRubricAction(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "");
  const criterionId = String(formData.get("criterionId") ?? "");
  const points = Number(formData.get("points"));
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  const criterion = await prisma.rubricCriterion.findUnique({ where: { id: criterionId } });
  if (!submission || !criterion || criterion.assignmentId !== submission.assignmentId) {
    return;
  }
  const access = await courseStudio(submission.assignment.courseId);
  if (!access?.isStaff || !Number.isInteger(points) || points < 0 || points > criterion.points) {
    return;
  }
  await prisma.rubricMark.upsert({
    where: { criterionId_submissionId: { criterionId, submissionId } },
    update: { points, comment: String(formData.get("comment") ?? "").slice(0, 500) },
    create: {
      criterionId,
      submissionId,
      points,
      comment: String(formData.get("comment") ?? "").slice(0, 500),
    },
  });
  refresh([`/workspace/learn/${submission.assignment.courseId}/assignments/${submission.assignmentId}`]);
}

export async function addSubmissionNoteAction(formData: FormData) {
  const viewer = await requireUser();
  const submissionId = String(formData.get("submissionId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1) {
    return;
  }
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  if (!submission) {
    return;
  }
  const access = await courseStudio(submission.assignment.courseId);
  if (!access?.isStaff) {
    return;
  }
  await prisma.submissionNote.create({
    data: {
      submissionId,
      authorId: viewer.userId,
      body: body.slice(0, 2000),
      quote: String(formData.get("quote") ?? "").trim().slice(0, 240),
    },
  });
  await notifyUser({
    userId: submission.studentId,
    kind: "academic",
    title: `Note on ${submission.assignment.title}`,
    body: body.slice(0, 240),
    href: `/workspace/learn/${submission.assignment.courseId}/assignments/${submission.assignmentId}`,
    preference: "notifyAcademic",
    mail: true,
  });
  refresh([`/workspace/learn/${submission.assignment.courseId}/assignments/${submission.assignmentId}`]);
}

export async function createDiscussionAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseStudio(courseId);
  if (!access?.isStaff) {
    return;
  }
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) {
    return;
  }
  const pointsRaw = String(formData.get("points") ?? "").trim();
  const points = pointsRaw === "" ? null : Number(pointsRaw);
  const discussion = await prisma.discussion.create({
    data: {
      courseId,
      title,
      body: String(formData.get("body") ?? "").slice(0, 8000),
      points: points !== null && Number.isInteger(points) && points > 0 ? points : null,
      createdById: viewer.userId,
    },
  });
  redirect(`/workspace/learn/${courseId}/discussions/${discussion.id}`);
}

export async function discussionStateAction(formData: FormData) {
  const id = String(formData.get("discussionId") ?? "");
  const discussion = await prisma.discussion.findUnique({ where: { id } });
  if (!discussion) {
    return;
  }
  const access = await courseStudio(discussion.courseId);
  if (!access?.isStaff) {
    return;
  }
  const action = String(formData.get("state") ?? "");
  await prisma.discussion.update({
    where: { id },
    data: {
      pinned: action === "pin" ? true : action === "unpin" ? false : discussion.pinned,
      closed: action === "close" ? true : action === "open" ? false : discussion.closed,
    },
  });
  refresh([`/workspace/learn/${discussion.courseId}/discussions`, `/workspace/learn/${discussion.courseId}/discussions/${id}`]);
}

export async function replyDiscussionAction(formData: FormData) {
  const viewer = await requireUser();
  const discussionId = String(formData.get("discussionId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!discussion || discussion.closed || body.length < 1) {
    return;
  }
  const access = await courseStudio(discussion.courseId);
  if (!access) {
    return;
  }
  const parentId = String(formData.get("parentId") ?? "") || null;
  await prisma.discussionPost.create({
    data: {
      discussionId,
      authorId: viewer.userId,
      authorName: viewer.name,
      body: body.slice(0, 4000),
      parentId,
    },
  });
  if (discussion.createdById !== viewer.userId) {
    await notifyUser({
      userId: discussion.createdById,
      kind: "academic",
      title: `Reply in ${discussion.title}`,
      body: `${viewer.name} replied.`,
      href: `/workspace/learn/${discussion.courseId}/discussions/${discussion.id}`,
      preference: "notifyAcademic",
      mail: true,
    });
  }
  refresh([`/workspace/learn/${discussion.courseId}/discussions/${discussion.id}`]);
}

export async function gradeDiscussionAction(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const points = Number(formData.get("points"));
  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!discussion?.points) {
    return;
  }
  const access = await courseStudio(discussion.courseId);
  if (!access?.isStaff || !Number.isFinite(points) || points < 0 || points > discussion.points) {
    return;
  }
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: discussion.courseId, userId: studentId } },
  });
  if (!enrollment) {
    return;
  }
  await prisma.discussionGrade.upsert({
    where: { discussionId_studentId: { discussionId, studentId } },
    update: { points, released: true },
    create: { discussionId, studentId, points, released: true },
  });
  await notifyUser({
    userId: studentId,
    kind: "academic",
    title: `Grade released for ${discussion.title}`,
    body: `${points} of ${discussion.points}.`,
    href: `/workspace/learn/${discussion.courseId}/discussions/${discussion.id}`,
    preference: "notifyAcademic",
    mail: true,
  });
  refresh([`/workspace/learn/${discussion.courseId}/discussions/${discussion.id}`]);
}

export async function addOutcomeAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseStudio(courseId);
  if (!access?.isStaff) {
    return;
  }
  const title = String(formData.get("title") ?? "").trim();
  const masteryPercent = Number(formData.get("masteryPercent") ?? 70);
  const requestedAssignment = String(formData.get("assignmentId") ?? "");
  if (title.length < 2 || !Number.isInteger(masteryPercent) || masteryPercent < 1 || masteryPercent > 100) {
    return;
  }
  const linked = requestedAssignment
    ? await prisma.assignment.findFirst({ where: { id: requestedAssignment, courseId }, select: { id: true } })
    : null;
  const outcome = await prisma.outcome.create({
    data: {
      courseId,
      title,
      description: String(formData.get("description") ?? "").slice(0, 2000),
      masteryPercent,
      assignmentId: linked?.id ?? null,
    },
  });
  if (linked) {
    await prisma.outcomeLink.create({ data: { outcomeId: outcome.id, assignmentId: linked.id } });
  }
  refresh([`/workspace/learn/${courseId}/outcomes`]);
}

export async function addOutcomeLinkAction(formData: FormData) {
  const outcomeId = String(formData.get("outcomeId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
  if (!outcome) {
    return;
  }
  const access = await courseStudio(outcome.courseId);
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId: outcome.courseId },
    select: { id: true },
  });
  if (!access?.isStaff || !assignment) {
    return;
  }
  await prisma.outcomeLink.upsert({
    where: { outcomeId_assignmentId: { outcomeId, assignmentId: assignment.id } },
    update: {},
    create: { outcomeId, assignmentId: assignment.id },
  });
  refresh([`/workspace/learn/${outcome.courseId}/outcomes`]);
}

export async function addAttendanceAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseStudio(courseId);
  if (!access?.isStaff) {
    return;
  }
  const title = String(formData.get("title") ?? "").trim();
  const heldAt = new Date(String(formData.get("heldAt") ?? ""));
  if (title.length < 2 || Number.isNaN(heldAt.getTime())) {
    return;
  }
  await prisma.attendanceSession.create({ data: { courseId, title, heldAt } });
  refresh([`/workspace/learn/${courseId}/attendance`]);
}

export async function markAttendanceAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["PRESENT", "LATE", "ABSENT", "EXCUSED"].includes(status)) {
    return;
  }
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return;
  }
  const access = await courseStudio(session.courseId);
  if (!access?.isStaff) {
    return;
  }
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: session.courseId, userId: studentId } },
  });
  if (!enrollment) {
    return;
  }
  await prisma.attendanceMark.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    update: { status },
    create: { sessionId, studentId, status },
  });
  refresh([`/workspace/learn/${session.courseId}/attendance`]);
}

export async function markAllPresentAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return;
  }
  const access = await courseStudio(session.courseId);
  if (!access?.isStaff) {
    return;
  }
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: session.courseId },
    select: { userId: true },
  });
  for (const enrollment of enrollments) {
    await prisma.attendanceMark.upsert({
      where: { sessionId_studentId: { sessionId, studentId: enrollment.userId } },
      update: { status: "PRESENT" },
      create: { sessionId, studentId: enrollment.userId, status: "PRESENT" },
    });
  }
  refresh([`/workspace/learn/${session.courseId}/attendance`]);
}

export async function addOfficeSlotAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseStudio(courseId);
  if (!access?.isStaff) {
    return;
  }
  const startsAt = new Date(String(formData.get("startsAt") ?? ""));
  const endsAt = new Date(String(formData.get("endsAt") ?? ""));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return;
  }
  await prisma.officeSlot.create({
    data: {
      courseId,
      hostId: viewer.userId,
      hostName: viewer.name,
      startsAt,
      endsAt,
      location: String(formData.get("location") ?? "").slice(0, 160),
    },
  });
  refresh([`/workspace/learn/${courseId}/hours`, "/workspace/calendar"]);
}

export async function claimOfficeSlotAction(formData: FormData) {
  const viewer = await requireUser();
  const slotId = String(formData.get("slotId") ?? "");
  const slot = await prisma.officeSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.claimantId || slot.hostId === viewer.userId) {
    return;
  }
  const access = await courseStudio(slot.courseId);
  if (!access?.enrolled) {
    return;
  }
  const updated = await prisma.officeSlot.updateMany({
    where: { id: slotId, claimantId: null },
    data: { claimantId: viewer.userId, claimantName: viewer.name, purpose: String(formData.get("purpose") ?? "").trim().slice(0, 280) },
  });
  if (updated.count === 0) {
    return;
  }
  const purpose = String(formData.get("purpose") ?? "").trim().slice(0, 280);
  await notifyUser({
    userId: slot.hostId,
    kind: "academic",
    title: "Office hour claimed",
    body: purpose
      ? `${viewer.name} claimed ${slot.startsAt.toLocaleString()}. ${purpose}`
      : `${viewer.name} claimed ${slot.startsAt.toLocaleString()}.`,
    href: `/workspace/learn/${slot.courseId}/hours`,
    preference: "notifyAcademic",
    mail: true,
  });
  refresh([`/workspace/learn/${slot.courseId}/hours`, "/workspace/calendar"]);
}

export async function releaseOfficeSlotAction(formData: FormData) {
  const viewer = await requireUser();
  const slotId = String(formData.get("slotId") ?? "");
  const slot = await prisma.officeSlot.findUnique({ where: { id: slotId } });
  if (!slot?.claimantId) {
    return;
  }
  const access = await courseStudio(slot.courseId);
  if (!access || (slot.claimantId !== viewer.userId && slot.hostId !== viewer.userId)) {
    return;
  }
  await prisma.officeSlot.update({
    where: { id: slotId },
    data: { claimantId: null, claimantName: null, purpose: "" },
  });
  if (slot.claimantId !== viewer.userId) {
    await notifyUser({
      userId: slot.claimantId,
      kind: "academic",
      title: "Office hour released",
      body: `${slot.hostName} opened ${slot.startsAt.toLocaleString()} again.`,
      href: `/workspace/learn/${slot.courseId}/hours`,
      preference: "notifyAcademic",
      mail: true,
    });
  }
  refresh([`/workspace/learn/${slot.courseId}/hours`, "/workspace/calendar"]);
}

export async function addToolAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseStudio(courseId);
  if (!access?.isStaff) {
    return;
  }
  const url = safeHttpUrl(String(formData.get("url") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  if (!url || name.length < 2) {
    return;
  }
  await prisma.courseTool.create({ data: { courseId, name, url } });
  refresh([`/workspace/learn/${courseId}/tools`]);
}

export async function postLiveMessageAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const access = await courseStudio(courseId);
  if (!access || body.length < 1) {
    return;
  }
  await prisma.courseLiveMessage.create({
    data: { courseId, authorId: viewer.userId, authorName: viewer.name, body: body.slice(0, 2000) },
  });
  refresh([`/workspace/learn/${courseId}/live`]);
}

export async function askCourseAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const access = await courseStudio(courseId);
  if (!access?.enrolled || access.isStaff || body.length < 2) {
    return;
  }
  await prisma.courseQuestion.create({
    data: { courseId, authorId: viewer.userId, authorName: viewer.name, body: body.slice(0, 2000) },
  });
  const staff = await prisma.courseStaff.findMany({ where: { courseId }, select: { userId: true } });
  for (const member of staff) {
    await notifyUser({
      userId: member.userId,
      kind: "academic",
      title: `Question in ${access.course.code}`,
      body: `${viewer.name}: ${body.slice(0, 180)}`,
      href: `/workspace/learn/${courseId}/ask`,
      preference: "notifyAcademic",
      mail: true,
    });
  }
  refresh([`/workspace/learn/${courseId}/ask`]);
}

export async function replyCourseAction(formData: FormData) {
  const viewer = await requireUser();
  const questionId = String(formData.get("questionId") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();
  const question = await prisma.courseQuestion.findUnique({ where: { id: questionId } });
  if (!question || reply.length < 2) {
    return;
  }
  const access = await courseStudio(question.courseId);
  if (!access?.isStaff) {
    return;
  }
  await prisma.courseQuestion.update({
    where: { id: questionId },
    data: { reply: reply.slice(0, 2000), repliedByName: viewer.name },
  });
  await notifyUser({
    userId: question.authorId,
    kind: "academic",
    title: `Reply in ${access.course.code}`,
    body: reply.slice(0, 180),
    href: `/workspace/learn/${question.courseId}/ask`,
    preference: "notifyAcademic",
    mail: true,
  });
  refresh([`/workspace/learn/${question.courseId}/ask`]);
}

export async function addPersonalEventAction(formData: FormData) {
  const viewer = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = new Date(String(formData.get("startsAt") ?? ""));
  if (title.length < 2 || Number.isNaN(startsAt.getTime())) {
    return;
  }
  const endsRaw = String(formData.get("endsAt") ?? "");
  const endsAt = endsRaw ? new Date(endsRaw) : null;
  const weeksRaw = Number(formData.get("weeks") ?? 1);
  const weeks = Number.isInteger(weeksRaw) ? Math.min(8, Math.max(1, weeksRaw)) : 1;
  for (let week = 0; week < weeks; week += 1) {
    const start = new Date(startsAt);
    start.setDate(start.getDate() + week * 7);
    const end = endsAt && !Number.isNaN(endsAt.getTime()) ? new Date(endsAt) : null;
    if (end) {
      end.setDate(end.getDate() + week * 7);
    }
    await prisma.personalEvent.create({
      data: { userId: viewer.userId, title, startsAt: start, endsAt: end },
    });
  }
  refresh(["/workspace/calendar"]);
}

export async function courseStudioAccess(courseId: string) {
  return courseStudio(courseId);
}

export async function loadMarking(courseId: string, assignmentId: string) {
  const access = await courseStudio(courseId);
  if (!access) {
    return null;
  }
  const criteria = await prisma.rubricCriterion.findMany({
    where: { assignmentId },
    orderBy: { position: "asc" },
    include: { marks: true, levels: { orderBy: { position: "asc" } } },
  });
  const notes = await prisma.submissionNote.findMany({
    where: { submission: { assignmentId } },
    orderBy: { createdAt: "asc" },
  });
  return { criteria, notes };
}
