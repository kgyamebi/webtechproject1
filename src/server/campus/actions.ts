"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db/client";
import { safeHttpUrl, simulatedImportShouldBeRemoved } from "@/server/academic/rules";
import { listDeadlines } from "@/server/academic/actions";
import { clashesWith } from "@/lib/campus-loop";
import { quietLabel } from "@/server/social/rules";

function refresh(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function listEvents() {
  const { userId } = await requireUser();
  const events = await prisma.campusEvent.findMany({
    orderBy: { startsAt: "asc" },
    include: { saves: { where: { userId } } },
    take: 50,
  });
  const quizzes = await prisma.quiz.findMany({
    where: { published: true, closeAt: { not: null }, course: { enrollments: { some: { userId } } } },
    select: { title: true, closeAt: true },
  });
  const assignments = await prisma.assignment.findMany({
    where: { published: true, course: { enrollments: { some: { userId } } } },
    select: { title: true, dueAt: true },
  });
  return events.map((event) => ({
    ...event,
    saved: event.saves.length > 0,
    clashes: [
      ...quizzes.flatMap((quiz) => (quiz.closeAt && clashesWith(event.startsAt, quiz.closeAt) ? [quiz.title] : [])),
      ...assignments.flatMap((assignment) => (clashesWith(event.startsAt, assignment.dueAt) ? [assignment.title] : [])),
    ],
  }));
}

export async function createEventAction(formData: FormData) {
  const viewer = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = new Date(String(formData.get("startsAt") ?? ""));
  if (title.length < 2 || Number.isNaN(startsAt.getTime())) {
    return;
  }
  const link = safeHttpUrl(String(formData.get("linkUrl") ?? ""));
  if (String(formData.get("linkUrl") ?? "").trim() && !link) {
    return;
  }
  const membership = await prisma.institutionMembership.findFirst({
    where: { userId: viewer.userId, isPrimary: true },
  });
  const user = await prisma.user.findUnique({ where: { id: viewer.userId }, select: { platformRole: true } });
  const staff = await prisma.courseStaff.findFirst({ where: { userId: viewer.userId, role: "LECTURER" } });
  await prisma.campusEvent.create({
    data: {
      title,
      description: String(formData.get("description") ?? "").slice(0, 2000),
      kind: String(formData.get("kind") ?? "campus").slice(0, 40),
      startsAt,
      endsAt: formData.get("endsAt") ? new Date(String(formData.get("endsAt"))) : null,
      location: String(formData.get("location") ?? "").slice(0, 160),
      official: formData.get("official") === "on" && (user?.platformRole === "PLATFORM_ADMIN" || Boolean(staff)),
      linkUrl: link ?? "",
      createdById: viewer.userId,
      institutionId: membership?.institutionId,
    },
  });
  refresh(["/workspace/events", "/workspace/calendar", "/workspace"]);
}

export async function saveEventAction(formData: FormData) {
  const { userId } = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const existing = await prisma.eventSave.findUnique({ where: { eventId_userId: { eventId, userId } } });
  if (existing) {
    await prisma.eventSave.delete({ where: { eventId_userId: { eventId, userId } } });
  } else {
    await prisma.eventSave.create({ data: { eventId, userId } });
  }
  refresh(["/workspace/events", "/workspace/calendar", "/workspace"]);
}

export async function listOpportunities() {
  const { userId } = await requireUser();
  const rows = await prisma.opportunity.findMany({
    orderBy: { createdAt: "desc" },
    include: { saves: { where: { userId } } },
    take: 50,
  });
  return rows.map((row) => ({ ...row, saved: row.saves.length > 0 }));
}

export async function createOpportunityAction(formData: FormData) {
  const viewer = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const url = safeHttpUrl(String(formData.get("url") ?? ""));
  if (title.length < 2 || !url) {
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: viewer.userId }, select: { platformRole: true } });
  const staff = await prisma.courseStaff.findFirst({ where: { userId: viewer.userId, role: "LECTURER" } });
  await prisma.opportunity.create({
    data: {
      title,
      description: String(formData.get("description") ?? "").slice(0, 2000),
      kind: String(formData.get("kind") ?? "internship").slice(0, 40),
      url,
      official: formData.get("official") === "on" && (user?.platformRole === "PLATFORM_ADMIN" || Boolean(staff)),
      createdById: viewer.userId,
    },
  });
  refresh(["/workspace/opportunities"]);
}

export async function saveOpportunityAction(formData: FormData) {
  const { userId } = await requireUser();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const existing = await prisma.opportunitySave.findUnique({
    where: { opportunityId_userId: { opportunityId, userId } },
  });
  if (existing) {
    await prisma.opportunitySave.delete({ where: { opportunityId_userId: { opportunityId, userId } } });
  } else {
    await prisma.opportunitySave.create({ data: { opportunityId, userId } });
  }
  refresh(["/workspace/opportunities"]);
}

export async function listNotifications() {
  const { userId } = await requireUser();
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
}

export async function markNotificationReadAction(formData: FormData) {
  const { userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id === "all") {
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  } else {
    await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  }
  refresh(["/workspace/notifications", "/workspace"]);
}

export async function listCalendar() {
  const viewer = await requireUser();
  const deadlines = await listDeadlines();
  const events = await prisma.campusEvent.findMany({
    where: { startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { startsAt: "asc" },
    take: 30,
    include: { saves: { where: { userId: viewer.userId }, select: { userId: true } } },
  });
  const personal = await prisma.personalEvent.findMany({
    where: { userId: viewer.userId, startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { startsAt: "asc" },
    take: 30,
  });
  const hours = await prisma.officeSlot.findMany({
    where: {
      OR: [{ hostId: viewer.userId }, { claimantId: viewer.userId }],
      startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { startsAt: "asc" },
    take: 20,
    include: { course: { select: { title: true } } },
  });
  return {
    ...deadlines,
    events: events.map((event) => ({ ...event, saved: event.saves.length > 0 })),
    personal,
    hours,
    name: viewer.name,
  };
}

export async function listLms() {
  const { userId } = await requireUser();
  const connections = await prisma.lmsConnection.findMany({
    where: { userId },
    include: { records: true },
    orderBy: { createdAt: "desc" },
  });
  return connections;
}

export async function connectSimulatedLmsAction() {
  const { userId } = await requireUser();
  const existing = await prisma.lmsConnection.findFirst({
    where: { userId, provider: "SIMULATED", status: "CONNECTED" },
  });
  if (existing) {
    return;
  }
  const connection = await prisma.lmsConnection.create({
    data: {
      userId,
      provider: "SIMULATED",
      label: "Simulated Canvas",
      status: "CONNECTED",
      lastSyncAt: new Date(),
    },
  });
  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const closeAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const course = await prisma.course.create({
    data: {
      code: "SIM-101",
      title: "Sample imported course",
      description: "This course was created by the simulated Canvas connector. It is not a live LMS import.",
      joinCode: `SIM${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      source: "SIMULATED",
      sourceLabel: "Simulated Canvas import. This is not connected to a real learning system.",
      createdById: userId,
      enrollments: { create: { userId } },
      modules: {
        create: {
          title: "Imported week",
          position: 1,
          materials: { create: { title: "Sample note" } },
        },
      },
      announcements: {
        create: {
          authorId: userId,
          title: "This import is simulated",
          body: "Nothing in this course was fetched from Canvas, Moodle, or Google Classroom. Disconnecting removes the course and leaves your other courses.",
        },
      },
      assignments: {
        create: {
          title: "Read the sample note",
          instructions:
            "This assignment exists so you can try a submission on a simulated import. It is not coursework from a live learning system.",
          dueAt,
          published: true,
          maxPoints: 10,
        },
      },
      quizzes: {
        create: {
          title: "Sample check",
          instructions: "One question about what this course is. The score stays hidden because this sample has no lecturer to release it.",
          closeAt,
          published: true,
          attemptLimit: 2,
          pointsReleased: false,
          questions: {
            create: {
              type: "SINGLE",
              prompt: "What is this course?",
              points: 1,
              position: 1,
              options: {
                create: [
                  { text: "A simulated sample", correct: true, position: 1 },
                  { text: "A live Canvas course", correct: false, position: 2 },
                ],
              },
            },
          },
        },
      },
    },
  });
  await prisma.syncRecord.create({
    data: {
      connectionId: connection.id,
      externalId: "simulated-course-101",
      localType: "COURSE",
      localId: course.id,
    },
  });
  refresh(["/workspace/integrations", "/workspace/learn", "/workspace", "/workspace/calendar"]);
}

export async function disconnectSimulatedLmsAction(formData: FormData) {
  const { userId } = await requireUser();
  const connectionId = String(formData.get("connectionId") ?? "");
  const connection = await prisma.lmsConnection.findUnique({
    where: { id: connectionId },
    include: { records: true },
  });
  if (!connection || connection.userId !== userId || connection.provider !== "SIMULATED") {
    return;
  }
  for (const record of connection.records) {
    if (record.localType !== "COURSE") {
      continue;
    }
    const course = await prisma.course.findUnique({ where: { id: record.localId } });
    if (course && simulatedImportShouldBeRemoved(course.source)) {
      await prisma.course.delete({ where: { id: course.id } });
    }
  }
  await prisma.lmsConnection.delete({ where: { id: connection.id } });
  refresh(["/workspace/integrations", "/workspace/learn", "/workspace", "/workspace/calendar"]);
}

export async function workspaceHome() {
  const viewer = await requireUser();
  const deadlines = await listDeadlines();
  const unread = await prisma.notification.count({ where: { userId: viewer.userId, readAt: null } });
  const courses = await prisma.course.count({
    where: { OR: [{ enrollments: { some: { userId: viewer.userId } } }, { staff: { some: { userId: viewer.userId } } }] },
  });
  const savedEvents = await prisma.campusEvent.findMany({
    where: { startsAt: { gte: new Date() }, saves: { some: { userId: viewer.userId } } },
    orderBy: { startsAt: "asc" },
    take: 3,
  });
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: viewer.userId },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { senderId: true, createdAt: true, deletedAt: true },
          },
        },
      },
    },
  });
  const unreadMessages = memberships.filter((membership) => {
    const message = membership.conversation.messages[0];
    return Boolean(
      message &&
        message.senderId !== viewer.userId &&
        !message.deletedAt &&
        (!membership.lastReadAt || message.createdAt > membership.lastReadAt),
    );
  }).length;
  const profile = await prisma.profile.findUnique({
    where: { userId: viewer.userId },
    select: { interests: true, subjects: true },
  });
  let quiet: { href: string; label: string } | null = null;
  if (viewer.band === "adult") {
    const intro = await prisma.quietIntroduction.findFirst({
      where: {
        status: { in: ["INTRODUCTION_CREATED", "ACTIVE", "REVEAL_REQUESTED", "REVEALED"] },
        OR: [{ userAId: viewer.userId }, { userBId: viewer.userId }],
      },
      include: { userA: { select: { name: true } }, userB: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    if (intro) {
      const viewerIsA = intro.userAId === viewer.userId;
      quiet = {
        href: `/workspace/quiet/${intro.id}`,
        label: quietLabel({
          status: intro.status,
          viewerIsA,
          aliasA: intro.aliasA,
          aliasB: intro.aliasB,
          nameA: intro.userA.name,
          nameB: intro.userB.name,
        }),
      };
    }
  }
  const publishedAssignments = await prisma.assignment.findMany({
    where: { published: true, course: { enrollments: { some: { userId: viewer.userId } } } },
    select: { submissions: { where: { studentId: viewer.userId }, select: { id: true } } },
  });
  const communities = await prisma.communityMember.findMany({
    where: { userId: viewer.userId, pending: false },
    take: 4,
    select: {
      community: {
        select: { id: true, name: true, _count: { select: { members: true } } },
      },
    },
  });
  const opportunities = await prisma.opportunity.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, kind: true, official: true },
  });
  return {
    deadlines,
    unread,
    courses,
    band: viewer.band,
    name: viewer.name,
    savedEvents,
    unreadMessages,
    needsTags: (profile?.interests.length ?? 0) === 0 && (profile?.subjects.length ?? 0) === 0,
    quiet,
    progress: {
      submitted: publishedAssignments.filter((assignment) => assignment.submissions.length > 0).length,
      published: publishedAssignments.length,
    },
    communities: communities.map((membership) => ({
      id: membership.community.id,
      name: membership.community.name,
      members: membership.community._count.members,
    })),
    opportunities,
  };
}
