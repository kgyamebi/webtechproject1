import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  CALL_TICKET_MS,
  callDisplayName,
  callRoomId,
  connectCallDecision,
  iceServersFor,
  maxCallPeers,
  mediaSecret,
  mediaSocketUrl,
  signTicket,
  type CallScope,
} from "@/lib/media-protocol";
import { sessionOpen } from "@/server/connect/rules";
import { prisma } from "@/server/db/client";
import { ageBandFromBirth } from "@/server/identity/policy";
import { mediaServerStatus } from "@/server/media/status";
import { blockedBetween } from "@/server/social/relations";

export type IssuedCall = {
  wsUrl: string;
  token: string;
  userId: string;
  maxPeers: number;
  relay: boolean;
  iceServers: RTCIceServer[];
};

export async function issueCallTicket(input: {
  scope: CallScope;
  id: string;
}): Promise<{ ok: true; ticket: IssuedCall } | { ok: false; status: number; error: string }> {
  const secret = mediaSecret();
  if (!secret) {
    return { ok: false, status: 503, error: "The media server is not configured." };
  }
  const roomId = callRoomId(input.scope, input.id);
  if (!roomId) {
    return { ok: false, status: 400, error: "That room is not valid." };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, status: 401, error: "Sign in first." };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, dateOfBirth: true },
  });
  if (!user) {
    return { ok: false, status: 401, error: "Sign in first." };
  }

  const allowed =
    input.scope === "connect"
      ? await allowConnectCall(user.id, user.dateOfBirth, input.id)
      : await allowCourseCall(user.id, user.name, input.id);
  if (!allowed.ok) {
    return allowed;
  }

  const health = await mediaServerStatus();
  if (!health.up) {
    return { ok: false, status: 503, error: "The media server is not running." };
  }

  const now = Date.now();
  const token = signTicket(
    {
      v: 1,
      scope: input.scope,
      roomId,
      userId: user.id,
      name: callDisplayName(allowed.name),
      exp: now + CALL_TICKET_MS,
    },
    secret,
  );

  return {
    ok: true,
    ticket: {
      wsUrl: mediaSocketUrl(),
      token,
      userId: user.id,
      maxPeers: maxCallPeers(input.scope),
      relay: health.turn,
      iceServers: health.turn ? iceServersFor(secret, user.id, now) : [],
    },
  };
}

async function allowConnectCall(
  userId: string,
  dateOfBirth: Date,
  sessionId: string,
): Promise<{ ok: true; name: string } | { ok: false; status: number; error: string }> {
  const participant = await prisma.connectParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    select: { alias: true, session: { select: { status: true } } },
  });
  const others = participant
    ? await prisma.connectParticipant.findMany({
        where: { sessionId, userId: { not: userId } },
        select: { userId: true },
      })
    : [];
  let blocked = false;
  for (const other of others) {
    if (await blockedBetween(userId, other.userId)) {
      blocked = true;
      break;
    }
  }
  const decision = connectCallDecision({
    band: ageBandFromBirth(dateOfBirth),
    open: Boolean(participant && sessionOpen(participant.session.status)),
    blocked,
  });
  if (!decision.ok) {
    return { ok: false, status: 403, error: decision.error };
  }
  return { ok: true, name: participant?.alias ?? "Guest" };
}

async function allowCourseCall(
  userId: string,
  name: string,
  courseId: string,
): Promise<{ ok: true; name: string } | { ok: false; status: number; error: string }> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      staff: { where: { userId }, select: { userId: true } },
      enrollments: { where: { userId }, select: { userId: true } },
    },
  });
  const member = Boolean(course && (course.staff.length > 0 || course.enrollments.length > 0));
  if (!member) {
    return { ok: false, status: 403, error: "You are not in this course." };
  }
  return { ok: true, name };
}
