"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db/client";
import {
  endSession,
  enterQueue,
  joinSession,
  leaveQueue,
  postMessage,
  reportTextOk,
  restrictSession,
  savePreferences,
  sharedWithPartner,
} from "@/server/connect/engine";
import { promptAt } from "@/server/connect/prompts";
import { CONNECT_MODES, randomConnectAllowed, type ConnectMode } from "@/server/connect/rules";
import { notifyUser } from "@/server/notifications";
import { listMessages } from "@/server/social/actions";
import { areFriends, blockedBetween } from "@/server/social/relations";

function asMode(value: string): ConnectMode {
  return CONNECT_MODES.includes(value as ConnectMode) ? (value as ConnectMode) : "SURPRISE";
}

export async function saveConnectPreferencesAction(formData: FormData) {
  const viewer = await requireUser();
  if (!randomConnectAllowed(viewer.band)) {
    return;
  }
  await savePreferences({
    userId: viewer.userId,
    available: formData.get("available") === "on",
    language: String(formData.get("language") ?? ""),
    mode: asMode(String(formData.get("mode") ?? "SURPRISE")),
    studyIntent: String(formData.get("studyIntent") ?? ""),
  });
  revalidatePath("/workspace/connect");
}

export async function joinConnectQueueAction(formData: FormData) {
  const viewer = await requireUser();
  const mode = asMode(String(formData.get("mode") ?? "SURPRISE"));
  const existing = await prisma.connectPreference.findUnique({ where: { userId: viewer.userId } });
  await savePreferences({
    userId: viewer.userId,
    available: true,
    language: existing?.language ?? "",
    mode,
    studyIntent: existing?.studyIntent ?? "",
  });
  const result = await enterQueue({ userId: viewer.userId, band: viewer.band, mode });
  if (!result.ok) {
    redirect(`/workspace/connect?notice=${encodeURIComponent(result.reason)}`);
  }
  if ("sessionId" in result) {
    redirect(`/workspace/connect/session/${result.sessionId}`);
  }
  redirect("/workspace/connect/waiting");
}

export async function cancelConnectQueueAction() {
  const viewer = await requireUser();
  await leaveQueue(viewer.userId);
  redirect("/workspace/connect");
}

export async function sendConnectMessageAction(formData: FormData) {
  const viewer = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const result = await postMessage({
    userId: viewer.userId,
    sessionId,
    body: String(formData.get("body") ?? ""),
    clientKey: String(formData.get("clientKey") ?? crypto.randomUUID()),
  });
  revalidatePath(`/workspace/connect/session/${sessionId}`);
  return result;
}

export async function endConnectSessionAction(formData: FormData) {
  const viewer = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const participants = await prisma.connectParticipant.findMany({ where: { sessionId } });
  await endSession(viewer.userId, sessionId);
  for (const participant of participants) {
    if (participant.userId !== viewer.userId) {
      await notifyUser({
        userId: participant.userId,
        kind: "CONNECT_ENDED",
        title: "A Random Connect chat ended",
        body: "The other person left the conversation.",
        href: "/workspace/connect",
        preference: "notifyMessages",
      });
    }
  }
  redirect("/workspace/connect/history");
}

export async function connectFriendAction(formData: FormData) {
  const { sendFriendRequestAction } = await import("@/server/social/actions");
  await sendFriendRequestAction(formData);
}

export async function connectBlockAction(formData: FormData) {
  const viewer = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const otherId = String(formData.get("userId") ?? "");
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId: viewer.userId } },
  });
  const other = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId: otherId } },
  });
  if (!participant || !other) {
    return;
  }
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: viewer.userId, blockedId: otherId } },
    update: {},
    create: { blockerId: viewer.userId, blockedId: otherId },
  });
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { fromUserId: viewer.userId, toUserId: otherId },
        { fromUserId: otherId, toUserId: viewer.userId },
      ],
    },
  });
  await restrictSession(viewer.userId, sessionId);
  redirect("/workspace/connect");
}

export async function connectReportAction(formData: FormData) {
  const viewer = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const category = String(formData.get("category") ?? "OTHER");
  const decision = reportTextOk(String(formData.get("reason") ?? ""));
  if (!decision.ok) {
    return;
  }
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId: viewer.userId } },
  });
  if (!participant) {
    return;
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.report.count({ where: { reporterId: viewer.userId, createdAt: { gte: hourAgo } } });
  if (recent >= 5) {
    return;
  }
  const report = await prisma.report.create({
    data: {
      reporterId: viewer.userId,
      targetType: "CONNECT_SESSION",
      targetId: sessionId,
      reason: `${category}: ${decision.reason}`,
    },
  });
  await prisma.moderationCase.create({ data: { reportId: report.id } });
  revalidatePath(`/workspace/connect/session/${sessionId}`);
}

export async function nextPromptAction(formData: FormData) {
  const viewer = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId: viewer.userId } },
  });
  if (!participant) {
    return;
  }
  await prisma.connectSession.update({
    where: { id: sessionId },
    data: { promptIndex: { increment: 1 } },
  });
  revalidatePath(`/workspace/connect/session/${sessionId}`);
}

export async function loadConnectHome() {
  const viewer = await requireUser();
  const preference = await prisma.connectPreference.findUnique({ where: { userId: viewer.userId } });
  const entry = await prisma.connectQueueEntry.findUnique({ where: { userId: viewer.userId } });
  const hold = await prisma.connectHold.findUnique({ where: { userId: viewer.userId } });
  const historyCount = await prisma.connectParticipant.count({ where: { userId: viewer.userId } });
  return {
    adult: randomConnectAllowed(viewer.band),
    admin: viewer.session.user.platformRole === "PLATFORM_ADMIN",
    preference,
    queued: Boolean(entry),
    sessionId: hold?.sessionId ?? null,
    historyCount,
  };
}

export async function loadConnectInbox() {
  const viewer = await requireUser();
  const home = await loadConnectHome();
  const conversations = home.adult ? await listMessages() : [];
  const sessions = home.adult ? await loadConnectHistory() : [];
  const friendships = home.adult
    ? await prisma.friendRequest.findMany({
        where: { status: "ACCEPTED", OR: [{ fromUserId: viewer.userId }, { toUserId: viewer.userId }] },
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
        },
        take: 16,
      })
    : [];
  return {
    ...home,
    conversations,
    sessions: sessions.map((row) => ({
      ...row,
      startedAt: row.startedAt.toISOString(),
      open: row.status === "MATCH_FOUND" || row.status === "SESSION_ACTIVE",
    })),
    friends: friendships.map((item) => {
      const person = item.fromUserId === viewer.userId ? item.toUser : item.fromUser;
      return { id: person.id, name: person.name };
    }),
  };
}

export async function loadConnectSession(sessionId: string) {
  const viewer = await requireUser();
  const session = await joinSession(viewer.userId, sessionId);
  if (!session) {
    return null;
  }
  const shared = await sharedWithPartner(viewer.userId, sessionId);
  const other = session.participants.find((item) => item.userId !== viewer.userId);
  const friends = other ? await areFriends(viewer.userId, other.userId) : false;
  const blocked = other ? await blockedBetween(viewer.userId, other.userId) : false;
  return {
    session,
    alias: shared.alias,
    reasons: shared.reasons,
    prompt: promptAt(session.promptIndex),
    otherId: other?.userId ?? "",
    friends,
    blocked,
    mine: viewer.userId,
  };
}

export async function loadConnectHistory() {
  const viewer = await requireUser();
  const rows = await prisma.connectParticipant.findMany({
    where: { userId: viewer.userId },
    include: { session: { include: { participants: true } } },
    orderBy: { session: { startedAt: "desc" } },
    take: 30,
  });
  const otherIds = rows
    .map((row) => row.session.participants.find((item) => item.userId !== viewer.userId)?.userId)
    .filter((id): id is string => Boolean(id));
  const requests = otherIds.length
    ? await prisma.friendRequest.findMany({
        where: {
          OR: otherIds.flatMap((id) => [
            { fromUserId: viewer.userId, toUserId: id },
            { fromUserId: id, toUserId: viewer.userId },
          ]),
        },
      })
    : [];
  return rows.map((row) => {
    const other = row.session.participants.find((item) => item.userId !== viewer.userId);
    const ended = row.session.endedAt;
    const duration = ended ? Math.max(0, Math.round((ended.getTime() - row.session.startedAt.getTime()) / 1000)) : null;
    const request = other
      ? requests.find(
          (item) =>
            (item.fromUserId === viewer.userId && item.toUserId === other.userId) ||
            (item.fromUserId === other.userId && item.toUserId === viewer.userId),
        )
      : undefined;
    return {
      id: row.sessionId,
      mode: row.session.mode,
      status: row.session.status,
      startedAt: row.session.startedAt,
      duration,
      alias: other?.alias ?? "Guest",
      friendStatus: request?.status ?? "NONE",
    };
  });
}

export async function deleteFinishedConnectHistoryAction() {
  const viewer = await requireUser();
  await prisma.connectParticipant.deleteMany({
    where: {
      userId: viewer.userId,
      session: { status: { in: ["COMPLETED", "CANCELLED", "RESTRICTED"] } },
    },
  });
  revalidatePath("/workspace/connect/history");
}

export async function loadModerationQueue() {
  const viewer = await requireUser();
  if (viewer.session.user.platformRole !== "PLATFORM_ADMIN") {
    return null;
  }
  const cases = await prisma.moderationCase.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { actions: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  const waiting = await prisma.connectQueueEntry.count();
  const active = await prisma.connectSession.count({ where: { status: { in: ["MATCH_FOUND", "SESSION_ACTIVE"] } } });
  const reportsToday = await prisma.report.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, targetType: "CONNECT_SESSION" },
  });
  const reportIds = cases.map((item) => item.reportId);
  const reports = await prisma.report.findMany({ where: { id: { in: reportIds } } });
  const byId = new Map(reports.map((report) => [report.id, report]));
  return {
    cases: cases.map((item) => ({ ...item, report: byId.get(item.reportId) ?? null })),
    waiting,
    active,
    reportsToday,
  };
}

export async function moderateCaseAction(formData: FormData) {
  const viewer = await requireUser();
  if (viewer.session.user.platformRole !== "PLATFORM_ADMIN") {
    return;
  }
  const caseId = String(formData.get("caseId") ?? "");
  const kind = String(formData.get("kind") ?? "NOTE");
  const note = String(formData.get("note") ?? "").slice(0, 500);
  const record = await prisma.moderationCase.findUnique({ where: { id: caseId } });
  if (!record) {
    return;
  }
  if (kind === "SUSPEND" || kind === "REINSTATE") {
    const report = await prisma.report.findUnique({ where: { id: record.reportId } });
    const targetSession = report?.targetType === "CONNECT_SESSION" ? report.targetId : "";
    const participants = targetSession
      ? await prisma.connectParticipant.findMany({ where: { sessionId: targetSession } })
      : [];
    const target = participants.find((item) => item.userId !== report?.reporterId);
    if (target && kind === "SUSPEND") {
      await prisma.accountRestriction.upsert({
        where: { userId: target.userId },
        update: { reason: note || "Suspended from Random Connect.", createdById: viewer.userId },
        create: { userId: target.userId, reason: note || "Suspended from Random Connect.", createdById: viewer.userId },
      });
    }
    if (target && kind === "REINSTATE") {
      await prisma.accountRestriction.deleteMany({ where: { userId: target.userId } });
    }
  }
  const status = kind === "ESCALATE" ? "ESCALATED" : kind === "CLOSE" ? "CLOSED" : kind === "REVIEW" ? "REVIEWING" : record.status;
  await prisma.$transaction([
    prisma.moderationCase.update({ where: { id: caseId }, data: { status, notes: note || record.notes } }),
    prisma.moderationAction.create({ data: { caseId, actorId: viewer.userId, kind, note } }),
  ]);
  revalidatePath("/workspace/moderate");
}
