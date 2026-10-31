import "server-only";

import { partnerTyping } from "@/server/connect/presence";
import { prisma } from "@/server/db/client";
import { ageBandFromBirth } from "@/server/identity/policy";
import { blockedBetween } from "@/server/social/relations";
import {
  canEnterQueue,
  nextConnectStatus,
  pairEligible,
  pickWeighted,
  scorePair,
  sessionOpen,
  validateConnectMessage,
  validateReportReason,
  type ConnectMode,
  type ConnectProfile,
} from "@/server/connect/rules";

const RECENT_WINDOW_MS = 12 * 60 * 60 * 1000;
const QUEUE_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

async function expireStale() {
  const queueCutoff = new Date(Date.now() - QUEUE_TTL_MS);
  const sessionCutoff = new Date(Date.now() - SESSION_TTL_MS);
  const now = new Date();
  await prisma.connectSession.updateMany({
    where: { status: "MATCH_FOUND", startedAt: { lt: sessionCutoff } },
    data: { status: "CANCELLED", endedAt: now },
  });
  await prisma.connectSession.updateMany({
    where: { status: "SESSION_ACTIVE", startedAt: { lt: sessionCutoff } },
    data: { status: "COMPLETED", endedAt: now },
  });
  await prisma.connectHold.deleteMany({
    where: { session: { status: { in: ["COMPLETED", "CANCELLED", "RESTRICTED"] } } },
  });
  await prisma.connectQueueEntry.deleteMany({ where: { createdAt: { lt: queueCutoff } } });
}

function aliasFor(userId: string): string {
  return `Guest ${userId.slice(0, 4).toUpperCase()}`;
}

async function profileOf(userId: string): Promise<ConnectProfile> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const preference = await prisma.connectPreference.findUnique({ where: { userId } });
  const membership = await prisma.institutionMembership.findFirst({ where: { userId, isPrimary: true } });
  return {
    interests: profile?.interests ?? [],
    subjects: profile?.subjects ?? [],
    careerInterests: profile?.careerInterests ?? [],
    projectGoals: profile?.projectGoals ?? [],
    language: preference?.language ?? "",
    studyIntent: preference?.studyIntent ?? "",
    institutionId: membership?.institutionId ?? null,
  };
}

async function recentlyPaired(leftId: string, rightId: string): Promise<boolean> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const sessions = await prisma.connectParticipant.findMany({
    where: { userId: leftId, session: { startedAt: { gte: since } } },
    select: { sessionId: true },
  });
  if (sessions.length === 0) {
    return false;
  }
  const again = await prisma.connectParticipant.findFirst({
    where: { userId: rightId, sessionId: { in: sessions.map((item) => item.sessionId) } },
    select: { sessionId: true },
  });
  return Boolean(again);
}

export async function savePreferences(input: {
  userId: string;
  available: boolean;
  language: string;
  mode: ConnectMode;
  studyIntent: string;
}) {
  await prisma.connectPreference.upsert({
    where: { userId: input.userId },
    update: {
      available: input.available,
      language: input.language.slice(0, 40),
      mode: input.mode,
      studyIntent: input.studyIntent.slice(0, 120),
    },
    create: {
      userId: input.userId,
      available: input.available,
      language: input.language.slice(0, 40),
      mode: input.mode,
      studyIntent: input.studyIntent.slice(0, 120),
    },
  });
}

export async function enterQueue(input: { userId: string; band: "adult" | "minor"; mode: ConnectMode }) {
  const restriction = await prisma.accountRestriction.findUnique({ where: { userId: input.userId } });
  const hold = await prisma.connectHold.findUnique({ where: { userId: input.userId } });
  const preference = await prisma.connectPreference.findUnique({ where: { userId: input.userId } });
  const decision = canEnterQueue({
    band: input.band,
    suspended: Boolean(restriction),
    alreadyHeld: Boolean(hold),
    available: Boolean(preference?.available),
  });
  if (!decision.ok) {
    return decision;
  }
  await prisma.connectQueueEntry.upsert({
    where: { userId: input.userId },
    update: { mode: input.mode, createdAt: new Date() },
    create: { userId: input.userId, mode: input.mode },
  });
  return tryMatch(input.userId);
}

export async function leaveQueue(userId: string) {
  await prisma.connectQueueEntry.deleteMany({ where: { userId } });
}

export async function tryMatch(userId: string): Promise<{ ok: true; sessionId: string } | { ok: true; waiting: true } | { ok: false; reason: string }> {
  await expireStale();
  const mine = await prisma.connectQueueEntry.findUnique({ where: { userId } });
  if (!mine) {
    const hold = await prisma.connectHold.findUnique({ where: { userId } });
    if (hold) {
      return { ok: true, sessionId: hold.sessionId };
    }
    return { ok: false, reason: "You are not in the queue." };
  }

  const queued = await prisma.connectQueueEntry.findMany({
    where: { userId: { not: userId } },
    include: { user: { select: { id: true, dateOfBirth: true } } },
    take: 40,
    orderBy: { createdAt: "asc" },
  });
  const viewerProfile = await profileOf(userId);
  const viewerUser = await prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } });
  const viewerBand = viewerUser ? (ageBandFromBirth(viewerUser.dateOfBirth) ?? "minor") : "minor";
  const viewerSuspended = Boolean(await prisma.accountRestriction.findUnique({ where: { userId } }));
  const ranked: Array<{ id: string; score: number }> = [];

  for (const candidate of queued) {
    const candidateBand = ageBandFromBirth(candidate.user.dateOfBirth) ?? "minor";
    const blocked = await blockedBetween(userId, candidate.userId);
    const candidateProfile = await profileOf(candidate.userId);
    const candidateHold = await prisma.connectHold.findUnique({ where: { userId: candidate.userId } });
    const candidateSuspended = await prisma.accountRestriction.findUnique({ where: { userId: candidate.userId } });
    const recent = await recentlyPaired(userId, candidate.userId);
    const allowed = pairEligible({
      samePerson: false,
      viewerBand,
      candidateBand,
      blocked,
      viewerSuspended,
      candidateSuspended: Boolean(candidateSuspended),
      candidateHeld: Boolean(candidateHold),
      recentlyPaired: recent,
      mode: mine.mode,
      viewer: viewerProfile,
      candidate: candidateProfile,
    });
    if (!allowed.ok) {
      continue;
    }
    ranked.push({ id: candidate.userId, score: scorePair(viewerProfile, candidateProfile).score });
  }

  const chosen = pickWeighted(ranked, Math.random);
  if (!chosen) {
    return { ok: true, waiting: true };
  }

  try {
    const sessionId = await prisma.$transaction(async (tx) => {
      const stillMine = await tx.connectQueueEntry.findUnique({ where: { userId } });
      const stillOther = await tx.connectQueueEntry.findUnique({ where: { userId: chosen.id } });
      if (!stillMine || !stillOther) {
        return null;
      }
      const session = await tx.connectSession.create({
        data: {
          mode: stillMine.mode,
          status: "MATCH_FOUND",
          participants: {
            create: [
              { userId, alias: aliasFor(userId) },
              { userId: chosen.id, alias: aliasFor(chosen.id) },
            ],
          },
          holds: {
            create: [{ userId }, { userId: chosen.id }],
          },
        },
      });
      await tx.connectQueueEntry.deleteMany({ where: { userId: { in: [userId, chosen.id] } } });
      return session.id;
    });
    if (!sessionId) {
      return { ok: true, waiting: true };
    }
    return { ok: true, sessionId };
  } catch {
    return { ok: true, waiting: true };
  }
}

export async function joinSession(userId: string, sessionId: string) {
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    include: { session: true },
  });
  if (!participant || !sessionOpen(participant.session.status)) {
    return null;
  }
  const next = nextConnectStatus(participant.session.status, "JOIN");
  if (next) {
    await prisma.connectSession.updateMany({
      where: { id: sessionId, status: "MATCH_FOUND" },
      data: { status: next },
    });
  }
  await prisma.connectParticipant.update({
    where: { sessionId_userId: { sessionId, userId } },
    data: { joinedAt: participant.joinedAt ?? new Date() },
  });
  return prisma.connectSession.findUnique({
    where: { id: sessionId },
    include: {
      participants: { include: { user: { select: { id: true, name: true } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });
}

export async function postMessage(input: { userId: string; sessionId: string; body: string; clientKey: string }) {
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId: input.sessionId, userId: input.userId } },
    include: { session: true },
  });
  if (!participant || !sessionOpen(participant.session.status)) {
    return { ok: false as const, reason: "This conversation is closed." };
  }
  const since = new Date(Date.now() - 60_000);
  const recent = await prisma.connectMessage.count({
    where: { sessionId: input.sessionId, senderId: input.userId, createdAt: { gte: since } },
  });
  const decision = validateConnectMessage(input.body, recent);
  if (!decision.ok) {
    return decision;
  }
  if (participant.session.status === "MATCH_FOUND") {
    await prisma.connectSession.updateMany({
      where: { id: input.sessionId, status: "MATCH_FOUND" },
      data: { status: "SESSION_ACTIVE" },
    });
  }
  await prisma.connectMessage.upsert({
    where: { sessionId_clientKey: { sessionId: input.sessionId, clientKey: input.clientKey.slice(0, 80) } },
    update: {},
    create: {
      sessionId: input.sessionId,
      senderId: input.userId,
      body: decision.body,
      clientKey: input.clientKey.slice(0, 80),
    },
  });
  return { ok: true as const };
}

export async function endSession(userId: string, sessionId: string) {
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    include: { session: { include: { participants: true } } },
  });
  if (!participant) {
    return;
  }
  const next = nextConnectStatus(participant.session.status, "END");
  if (!next) {
    return;
  }
  await prisma.$transaction([
    prisma.connectSession.update({
      where: { id: sessionId },
      data: { status: next, endedAt: new Date(), endedById: userId },
    }),
    prisma.connectHold.deleteMany({ where: { sessionId } }),
  ]);
}

export async function restrictSession(userId: string, sessionId: string) {
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    include: { session: true },
  });
  if (!participant || !sessionOpen(participant.session.status)) {
    return;
  }
  const next = nextConnectStatus(participant.session.status, "RESTRICT");
  if (!next) {
    return;
  }
  await prisma.$transaction([
    prisma.connectSession.update({
      where: { id: sessionId },
      data: { status: next, endedAt: new Date(), endedById: userId },
    }),
    prisma.connectHold.deleteMany({ where: { sessionId } }),
  ]);
}

export async function messagesAfter(sessionId: string, userId: string, after: Date) {
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  });
  if (!participant) {
    return null;
  }
  const found = await prisma.connectMessage.findMany({
    where: { sessionId, createdAt: { gt: after } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const messages = found.reverse();
  const session = await prisma.connectSession.findUnique({ where: { id: sessionId }, select: { status: true } });
  const others = await prisma.connectParticipant.findMany({ where: { sessionId, userId: { not: userId } }, select: { userId: true } });
  return {
    status: session?.status ?? "COMPLETED",
    typing: others.some((person) => partnerTyping(`connect:${sessionId}`, person.userId)),
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      mine: message.senderId === userId,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function queueSnapshot(userId: string) {
  const entry = await prisma.connectQueueEntry.findUnique({ where: { userId } });
  const hold = await prisma.connectHold.findUnique({ where: { userId } });
  return { queued: Boolean(entry), sessionId: hold?.sessionId ?? null, since: entry?.createdAt.toISOString() ?? null };
}

export async function sharedWithPartner(userId: string, sessionId: string) {
  const participants = await prisma.connectParticipant.findMany({ where: { sessionId } });
  const other = participants.find((item) => item.userId !== userId);
  if (!other || !participants.some((item) => item.userId === userId)) {
    return { alias: "Guest", reasons: [] as string[] };
  }
  const mine = await profileOf(userId);
  const theirs = await profileOf(other.userId);
  return { alias: other.alias, reasons: scorePair(mine, theirs).reasons };
}

export function reportTextOk(reason: string) {
  return validateReportReason(reason);
}
