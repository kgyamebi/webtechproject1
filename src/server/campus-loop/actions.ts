"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db/client";
import { ageBandFromBirth } from "@/server/identity/policy";
import { DESK_TOGETHER_MS, formatMinute, quietHoursSleeping, weekStartMonday } from "@/lib/campus-loop";
import { notifyUser } from "@/server/notifications";
import { areFriends, friendIds } from "@/server/social/relations";

function refresh(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function updatePresenceAction(formData: FormData) {
  const { userId } = await requireUser();
  const presence = String(formData.get("presence") ?? "AVAILABLE");
  const start = String(formData.get("quietStart") ?? "23:00");
  const end = String(formData.get("quietEnd") ?? "07:00");
  if (presence !== "AVAILABLE" && presence !== "IN_CLASS" && presence !== "FOCUSING") {
    return;
  }
  await prisma.profile.update({
    where: { userId },
    data: {
      presence,
      shareReadReceipts: formData.get("shareReadReceipts") === "on",
      shareTyping: formData.get("shareTyping") === "on",
      shareDeadlineLine: formData.get("shareDeadlineLine") === "on",
      quietHoursOn: formData.get("quietHoursOn") === "on",
      quietStartMinute: minuteFromClock(start),
      quietEndMinute: minuteFromClock(end),
    },
  });
  refresh(["/workspace/settings", "/workspace/feed", "/workspace", "/workspace/messages"]);
}

function minuteFromClock(value: string) {
  const [hours, minutes] = value.split(":");
  const hour = Number(hours);
  const minute = Number(minutes);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return 23 * 60;
  }
  return hour * 60 + minute;
}

export async function feedGate() {
  const { userId } = await requireUser();
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { quietHoursOn: true, quietStartMinute: true, quietEndMinute: true },
  });
  const now = new Date();
  const sleeping = profile
    ? quietHoursSleeping(profile.quietHoursOn, profile.quietStartMinute, profile.quietEndMinute, now)
    : false;
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const quiz = await prisma.quiz.findFirst({
    where: {
      published: true,
      closeAt: { gte: now, lte: soon },
      course: { enrollments: { some: { userId } } },
    },
    orderBy: { closeAt: "asc" },
    select: { title: true, closeAt: true, course: { select: { title: true } } },
  });
  return {
    sleeping,
    wakes: profile ? formatMinute(profile.quietEndMinute) : "",
    quiz: quiz?.closeAt ? { title: quiz.title, courseTitle: quiz.course.title, closeAt: quiz.closeAt } : null,
  };
}

export async function deskLoop() {
  const viewer = await requireUser();
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await sweepWalkAlerts(viewer.userId, now);
  const quiz = await prisma.quiz.findFirst({
    where: {
      published: true,
      closeAt: { gte: now, lte: soon },
      course: { enrollments: { some: { userId: viewer.userId } } },
    },
    orderBy: { closeAt: "asc" },
    select: { id: true, title: true, closeAt: true, courseId: true, course: { select: { title: true } } },
  });
  const friends = await friendIds(viewer.userId);
  const sharing = friends.length
    ? await prisma.profile.findMany({
        where: { userId: { in: friends }, shareDeadlineLine: true },
        select: { userId: true },
      })
    : [];
  const sharingIds = sharing.map((row) => row.userId);
  const friendQuizzes = sharingIds.length
    ? await prisma.quiz.findMany({
        where: {
          published: true,
          closeAt: { gte: now, lte: soon },
          course: { enrollments: { some: { userId: { in: sharingIds } } } },
        },
        select: {
          title: true,
          course: {
            select: {
              enrollments: {
                where: { userId: { in: sharingIds } },
                select: { user: { select: { name: true } } },
              },
            },
          },
        },
        take: 8,
      })
    : [];
  const friendLines: { name: string; quizTitle: string }[] = [];
  for (const row of friendQuizzes) {
    for (const enrollment of row.course.enrollments) {
      friendLines.push({ name: enrollment.user.name, quizTitle: row.title });
    }
  }
  const enrolled = await prisma.enrollment.findMany({
    where: { userId: viewer.userId },
    select: { courseId: true },
  });
  const courseIds = enrolled.map((row) => row.courseId);
  const together = courseIds.length && friends.length
    ? await prisma.deskSession.findMany({
        where: {
          showFriends: true,
          endsAt: { gt: now },
          courseId: { in: courseIds },
          userId: { in: friends },
        },
        include: { user: { select: { name: true } } },
        orderBy: { endsAt: "asc" },
        take: 8,
      })
    : [];
  const walks = await prisma.walkCheck.findMany({
    where: { userId: viewer.userId, arrivedAt: null, endedAt: null },
    orderBy: { dueAt: "asc" },
    take: 5,
  });
  return {
    soonQuiz: quiz?.closeAt
      ? {
          title: quiz.title,
          courseTitle: quiz.course.title,
          href: `/workspace/learn/${quiz.courseId}/quizzes/${quiz.id}`,
          closeAt: quiz.closeAt,
        }
      : null,
    friendLines: friendLines.slice(0, 6),
    together: together.map((session) => ({
      name: session.user.name,
      assignmentTitle: session.assignmentTitle,
      endsAt: session.endsAt,
    })),
    walks,
    sunday: now.getDay() === 0,
  };
}

async function sweepWalkAlerts(userId: string, now: Date) {
  const due = await prisma.walkCheck.findMany({
    where: { friendId: userId, dueAt: { lte: now }, arrivedAt: null, endedAt: null, alertedAt: null },
    include: { owner: { select: { name: true } } },
    take: 10,
  });
  for (const walk of due) {
    await notifyUser({
      userId,
      kind: "WALK",
      title: "A friend has not arrived",
      body: `${walk.owner.name} has not arrived at ${walk.place}.`,
      href: "/workspace/friends",
      preference: "notifyMessages",
    });
    await prisma.walkCheck.update({ where: { id: walk.id }, data: { alertedAt: now } });
  }
}

export async function startDeskTogetherAction(formData: FormData) {
  const viewer = await requireUser();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, title: true, courseId: true },
  });
  if (!assignment) {
    return;
  }
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: assignment.courseId, userId: viewer.userId } },
  });
  const staff = await prisma.courseStaff.findUnique({
    where: { courseId_userId: { courseId: assignment.courseId, userId: viewer.userId } },
  });
  if (!enrolled && !staff) {
    return;
  }
  const existing = await prisma.deskSession.findFirst({
    where: { userId: viewer.userId, assignmentId, endsAt: { gt: new Date() } },
  });
  if (existing) {
    await prisma.deskSession.delete({ where: { id: existing.id } });
  } else if (formData.get("showFriends") === "on") {
    await prisma.deskSession.create({
      data: {
        userId: viewer.userId,
        assignmentId,
        courseId: assignment.courseId,
        assignmentTitle: assignment.title,
        showFriends: true,
        endsAt: new Date(Date.now() + DESK_TOGETHER_MS),
      },
    });
  }
  refresh([`/workspace/learn/${assignment.courseId}/assignments/${assignmentId}`, "/workspace"]);
}

export async function assignmentLoop(assignmentId: string) {
  const viewer = await requireUser();
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, courseId: true, title: true },
  });
  if (!assignment) {
    return null;
  }
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: assignment.courseId, userId: viewer.userId } },
  });
  const staff = await prisma.courseStaff.findUnique({
    where: { courseId_userId: { courseId: assignment.courseId, userId: viewer.userId } },
  });
  if (!enrolled && !staff) {
    return null;
  }
  const decisions = await prisma.assignmentDecision.findMany({
    where: { assignmentId },
    orderBy: { createdAt: "asc" },
  });
  const classmates = await prisma.enrollment.findMany({
    where: { courseId: assignment.courseId, userId: { not: viewer.userId } },
    select: { user: { select: { id: true, name: true } } },
  });
  const mineThanks = await prisma.assignmentThanks.findUnique({
    where: { assignmentId_fromUserId: { assignmentId, fromUserId: viewer.userId } },
  });
  const session = await prisma.deskSession.findFirst({
    where: { userId: viewer.userId, assignmentId, endsAt: { gt: new Date() } },
  });
  const notes = await prisma.officeQueueEntry.findMany({
    where: { assignmentId, status: "done", note: { not: "" } },
    orderBy: { createdAt: "asc" },
  });
  const together = await prisma.deskSession.findMany({
    where: { assignmentId, showFriends: true, endsAt: { gt: new Date() }, userId: { not: viewer.userId } },
    include: { user: { select: { id: true, name: true } } },
  });
  const visibleTogether = [];
  for (const row of together) {
    if (await areFriends(viewer.userId, row.userId)) {
      visibleTogether.push({ name: row.user.name, endsAt: row.endsAt });
    }
  }
  return {
    decisions,
    classmates: classmates.map((row) => row.user),
    thankedUserId: mineThanks?.toUserId ?? "",
    sessionEnds: session?.endsAt ?? null,
    notes: notes.filter((note) => staff || note.studentId === viewer.userId),
    together: visibleTogether,
  };
}

export async function addDecisionAction(formData: FormData) {
  const viewer = await requireUser();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { courseId: true } });
  if (!assignment || body.length < 2 || body.length > 280) {
    return;
  }
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: assignment.courseId, userId: viewer.userId } },
  });
  const staff = await prisma.courseStaff.findUnique({
    where: { courseId_userId: { courseId: assignment.courseId, userId: viewer.userId } },
  });
  if (!enrolled && !staff) {
    return;
  }
  await prisma.assignmentDecision.create({
    data: { assignmentId, authorId: viewer.userId, authorName: viewer.name, body },
  });
  refresh([`/workspace/learn/${assignment.courseId}/assignments/${assignmentId}`]);
}

export async function thankClassmateAction(formData: FormData) {
  const viewer = await requireUser();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  if (!toUserId || toUserId === viewer.userId) {
    return;
  }
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { courseId: true } });
  if (!assignment) {
    return;
  }
  const fromEnrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: assignment.courseId, userId: viewer.userId } },
  });
  const toEnrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: assignment.courseId, userId: toUserId } },
  });
  if (!fromEnrollment || !toEnrollment) {
    return;
  }
  const existing = await prisma.assignmentThanks.findUnique({
    where: { assignmentId_fromUserId: { assignmentId, fromUserId: viewer.userId } },
  });
  if (existing) {
    return;
  }
  await prisma.assignmentThanks.create({
    data: { assignmentId, fromUserId: viewer.userId, toUserId },
  });
  refresh([`/workspace/learn/${assignment.courseId}/assignments/${assignmentId}`, "/workspace/profile"]);
}

export async function helpedCourses(userId: string) {
  const thanks = await prisma.assignmentThanks.findMany({
    where: { toUserId: userId },
    select: { assignment: { select: { course: { select: { title: true } } } } },
  });
  return [...new Set(thanks.map((row) => row.assignment.course.title))];
}

export async function reviewForQuiz(quizId: string) {
  const viewer = await requireUser();
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { select: { id: true, prompt: true, points: true } } },
  });
  if (!quiz) {
    return null;
  }
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: quiz.courseId, userId: viewer.userId } },
  });
  if (!enrolled) {
    return null;
  }
  const attempt = await prisma.quizAttempt.findFirst({
    where: { quizId, studentId: viewer.userId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    include: { answers: true },
  });
  if (!attempt) {
    return { missed: [] as { questionId: string; prompt: string; optedIn: boolean; names: string[] }[] };
  }
  const missed = [];
  for (const question of quiz.questions) {
    const answer = attempt.answers.find((item) => item.questionId === question.id);
    if (!answer || answer.awardedPoints === null || answer.awardedPoints >= question.points) {
      continue;
    }
    const opted = await prisma.reviewOptIn.findMany({
      where: { questionId: question.id },
      include: { user: { select: { id: true, name: true } } },
    });
    const mine = opted.some((row) => row.userId === viewer.userId);
    const names = mine
      ? opted.filter((row) => row.userId !== viewer.userId).map((row) => row.user.name)
      : [];
    missed.push({ questionId: question.id, prompt: question.prompt, optedIn: mine, names });
  }
  return { missed };
}

export async function optInReviewAction(formData: FormData) {
  const viewer = await requireUser();
  const quizId = String(formData.get("quizId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { select: { id: true, points: true } } },
  });
  if (!quiz) {
    return;
  }
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: quiz.courseId, userId: viewer.userId } },
  });
  const question = quiz.questions.find((item) => item.id === questionId);
  if (!enrolled || !question) {
    return;
  }
  const attempt = await prisma.quizAttempt.findFirst({
    where: { quizId, studentId: viewer.userId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    include: { answers: true },
  });
  const answer = attempt?.answers.find((item) => item.questionId === questionId);
  if (!answer || answer.awardedPoints === null || answer.awardedPoints >= question.points) {
    return;
  }
  await prisma.reviewOptIn.upsert({
    where: { questionId_userId: { questionId, userId: viewer.userId } },
    update: {},
    create: { quizId, questionId, userId: viewer.userId },
  });
  refresh([`/workspace/learn/${quiz.courseId}/quizzes/${quizId}`]);
}

export async function officeQueue(courseId: string) {
  const viewer = await requireUser();
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId: viewer.userId } },
  });
  const staff = await prisma.courseStaff.findUnique({
    where: { courseId_userId: { courseId, userId: viewer.userId } },
  });
  if (!enrolled && !staff) {
    return null;
  }
  const rows = await prisma.officeQueueEntry.findMany({
    where: { courseId, status: { in: ["waiting", "done"] } },
    orderBy: { createdAt: "asc" },
  });
  const assignments = await prisma.assignment.findMany({
    where: { courseId, published: true },
    select: { id: true, title: true },
  });
  const waiting = rows.filter((row) => row.status === "waiting");
  return {
    isStaff: Boolean(staff),
    assignments,
    waiting: waiting.map((row, index) => ({
      ...row,
      position: index + 1,
      visible: Boolean(staff) || row.studentId === viewer.userId,
    })),
    done: rows.filter((row) => row.status === "done" && (staff || row.studentId === viewer.userId)),
  };
}

export async function joinOfficeQueueAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (reason.length < 2) {
    return;
  }
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId: viewer.userId } },
  });
  if (!enrolled) {
    return;
  }
  const open = await prisma.officeQueueEntry.findFirst({
    where: { courseId, studentId: viewer.userId, status: "waiting" },
  });
  if (open) {
    return;
  }
  await prisma.officeQueueEntry.create({
    data: {
      courseId,
      studentId: viewer.userId,
      studentName: viewer.name,
      assignmentId,
      reason: reason.slice(0, 280),
    },
  });
  refresh([`/workspace/learn/${courseId}/hours`]);
}

export async function officeQueueNoteAction(formData: FormData) {
  const viewer = await requireUser();
  const id = String(formData.get("id") ?? "");
  const entry = await prisma.officeQueueEntry.findUnique({ where: { id } });
  if (!entry) {
    return;
  }
  const staff = await prisma.courseStaff.findUnique({
    where: { courseId_userId: { courseId: entry.courseId, userId: viewer.userId } },
  });
  if (!staff) {
    return;
  }
  const action = String(formData.get("queueAction") ?? "");
  if (action === "close") {
    await prisma.officeQueueEntry.updateMany({
      where: { courseId: entry.courseId, status: "waiting" },
      data: { status: "closed" },
    });
  } else if (action === "done") {
    await prisma.officeQueueEntry.update({
      where: { id },
      data: { status: "done", note: String(formData.get("note") ?? "").slice(0, 500) },
    });
  }
  refresh([`/workspace/learn/${entry.courseId}/hours`, `/workspace/learn/${entry.courseId}/assignments/${entry.assignmentId}`]);
}

export async function leaveOfficeQueueAction(formData: FormData) {
  const viewer = await requireUser();
  const id = String(formData.get("id") ?? "");
  const entry = await prisma.officeQueueEntry.findUnique({ where: { id } });
  if (!entry || entry.studentId !== viewer.userId || entry.status !== "waiting") {
    return;
  }
  await prisma.officeQueueEntry.update({ where: { id }, data: { status: "left" } });
  refresh([`/workspace/learn/${entry.courseId}/hours`]);
}

export async function weekCard() {
  const viewer = await requireUser();
  const now = new Date();
  const start = weekStartMonday(now);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const submissions = await prisma.submission.findMany({
    where: { studentId: viewer.userId, submittedAt: { gte: start, lt: end } },
    select: { assignment: { select: { title: true } } },
  });
  const sessions = await prisma.deskSession.findMany({
    where: { userId: viewer.userId, createdAt: { gte: start, lt: end }, showFriends: true },
    select: { assignmentId: true, courseId: true },
  });
  const studied: string[] = [];
  for (const session of sessions) {
    const peers = await prisma.deskSession.findMany({
      where: {
        assignmentId: session.assignmentId,
        userId: { not: viewer.userId },
        createdAt: { gte: start, lt: end },
        showFriends: true,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    for (const peer of peers) {
      if ((await areFriends(viewer.userId, peer.userId)) && !studied.includes(peer.user.name)) {
        studied.push(peer.user.name);
      }
    }
  }
  const saved = await prisma.campusEvent.findMany({
    where: { startsAt: { gte: start, lt: end }, saves: { some: { userId: viewer.userId } } },
    select: { title: true },
  });
  const shared = await prisma.weekShare.findUnique({
    where: { userId_weekStart: { userId: viewer.userId, weekStart: start } },
  });
  const lines = [
    submissions.length ? `Submitted: ${submissions.map((row) => row.assignment.title).join(", ")}.` : "Nothing submitted this week.",
    studied.length ? `Studied with ${studied.join(", ")}.` : "No shared study session this week.",
    saved.length ? `Saved: ${saved.map((row) => row.title).join(", ")}.` : "No saved event this week.",
  ];
  return { start, lines, shared: Boolean(shared), sunday: now.getDay() === 0 };
}

export async function shareWeekCardAction() {
  const viewer = await requireUser();
  const start = weekStartMonday(new Date());
  const existing = await prisma.weekShare.findUnique({
    where: { userId_weekStart: { userId: viewer.userId, weekStart: start } },
  });
  if (existing) {
    return;
  }
  const card = await weekCard();
  await prisma.post.create({
    data: {
      authorId: viewer.userId,
      body: `Week of ${start.toLocaleDateString()}. ${card.lines.join(" ")}`.slice(0, 2000),
      audience: "CONNECTIONS",
    },
  });
  await prisma.weekShare.create({ data: { userId: viewer.userId, weekStart: start } });
  refresh(["/workspace/week", "/workspace/feed"]);
}

export async function taskBoard(courseId: string) {
  const viewer = await requireUser();
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId: viewer.userId } },
  });
  const staff = await prisma.courseStaff.findUnique({
    where: { courseId_userId: { courseId, userId: viewer.userId } },
  });
  if (!enrolled && !staff) {
    return null;
  }
  const finishedQuizzes = await prisma.quizAttempt.findMany({
    where: { studentId: viewer.userId, status: "SUBMITTED", quiz: { courseId } },
    select: { quiz: { select: { title: true } } },
  });
  const finishedAssignments = await prisma.submission.findMany({
    where: { studentId: viewer.userId, assignment: { courseId } },
    select: { assignment: { select: { title: true } } },
  });
  const finished = [
    ...finishedQuizzes.map((row) => row.quiz.title),
    ...finishedAssignments.map((row) => row.assignment.title),
  ];
  const offers = await prisma.taskOffer.findMany({
    where: { courseId, freeEnd: { gt: new Date() } },
    orderBy: { freeStart: "asc" },
  });
  const people = await prisma.user.findMany({
    where: { id: { in: offers.map((offer) => offer.userId) } },
    select: { id: true, dateOfBirth: true },
  });
  const bands = new Map(people.map((person) => [person.id, ageBandFromBirth(person.dateOfBirth)]));
  return {
    finished: [...new Set(finished)],
    offers: offers
      .filter((offer) => offer.userId === viewer.userId || bands.get(offer.userId) === viewer.band)
      .map((offer) => ({
        id: offer.id,
        name: offer.userName,
        finishedLabel: offer.finishedLabel,
        freeStart: offer.freeStart,
        freeEnd: offer.freeEnd,
        mine: offer.userId === viewer.userId,
      })),
  };
}

export async function postTaskOfferAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const finishedLabel = String(formData.get("finishedLabel") ?? "").trim();
  const freeStart = new Date(String(formData.get("freeStart") ?? ""));
  const freeEnd = new Date(String(formData.get("freeEnd") ?? ""));
  if (!finishedLabel || Number.isNaN(freeStart.getTime()) || Number.isNaN(freeEnd.getTime()) || freeEnd <= freeStart) {
    return;
  }
  const enrolled = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId: viewer.userId } },
  });
  if (!enrolled) {
    return;
  }
  await prisma.taskOffer.create({
    data: {
      userId: viewer.userId,
      userName: viewer.name,
      courseId,
      finishedLabel: finishedLabel.slice(0, 120),
      freeStart,
      freeEnd,
    },
  });
  refresh([`/workspace/learn/${courseId}`]);
}

export async function removeTaskOfferAction(formData: FormData) {
  const viewer = await requireUser();
  const id = String(formData.get("id") ?? "");
  const offer = await prisma.taskOffer.findUnique({ where: { id } });
  if (!offer || offer.userId !== viewer.userId) {
    return;
  }
  await prisma.taskOffer.delete({ where: { id } });
  refresh([`/workspace/learn/${offer.courseId}`]);
}

export async function friendWalkChoices() {
  const viewer = await requireUser();
  const ids = await friendIds(viewer.userId);
  const people = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const walks = await prisma.walkCheck.findMany({
    where: { userId: viewer.userId, arrivedAt: null, endedAt: null },
    orderBy: { dueAt: "asc" },
  });
  return { people, walks };
}

export async function startWalkCheckAction(formData: FormData) {
  const viewer = await requireUser();
  const friendId = String(formData.get("friendId") ?? "");
  const place = String(formData.get("place") ?? "").trim();
  const dueAt = new Date(String(formData.get("dueAt") ?? ""));
  if (!place || place.length > 80 || Number.isNaN(dueAt.getTime()) || dueAt.getTime() < Date.now()) {
    return;
  }
  if (!(await areFriends(viewer.userId, friendId))) {
    return;
  }
  await prisma.walkCheck.create({
    data: { userId: viewer.userId, friendId, place, dueAt },
  });
  refresh(["/workspace/friends", "/workspace"]);
}

export async function arriveWalkAction(formData: FormData) {
  const viewer = await requireUser();
  const id = String(formData.get("id") ?? "");
  const walk = await prisma.walkCheck.findUnique({ where: { id } });
  if (!walk || walk.userId !== viewer.userId || walk.endedAt || walk.alertedAt) {
    return;
  }
  await prisma.walkCheck.update({ where: { id }, data: { arrivedAt: new Date() } });
  refresh(["/workspace/friends", "/workspace"]);
}

export async function endWalkAction(formData: FormData) {
  const viewer = await requireUser();
  const id = String(formData.get("id") ?? "");
  const walk = await prisma.walkCheck.findUnique({ where: { id } });
  if (!walk || walk.userId !== viewer.userId || walk.alertedAt) {
    return;
  }
  await prisma.walkCheck.update({ where: { id }, data: { endedAt: new Date() } });
  refresh(["/workspace/friends", "/workspace"]);
}
