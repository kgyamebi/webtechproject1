import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db/client";

export async function POST(request: Request) {
  const viewer = await requireUser();
  const body = (await request.json().catch(() => null)) as { conversationId?: string } | null;
  const conversationId = body?.conversationId ?? "";
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewer.userId } },
  });
  const profile = await prisma.profile.findUnique({
    where: { userId: viewer.userId },
    select: { shareTyping: true },
  });
  if (!membership || !profile?.shareTyping) {
    return NextResponse.json({ ok: false });
  }
  await prisma.typingPulse.upsert({
    where: { conversationId_userId: { conversationId, userId: viewer.userId } },
    update: { updatedAt: new Date() },
    create: { conversationId, userId: viewer.userId },
  });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const viewer = await requireUser();
  const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "";
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewer.userId } },
  });
  if (!membership) {
    return NextResponse.json({ names: [] });
  }
  const since = new Date(Date.now() - 8_000);
  const pulses = await prisma.typingPulse.findMany({
    where: { conversationId, updatedAt: { gte: since }, userId: { not: viewer.userId } },
    include: { user: { select: { name: true, profile: { select: { shareTyping: true } } } } },
  });
  return NextResponse.json({
    names: pulses.filter((pulse) => pulse.user.profile?.shareTyping).map((pulse) => pulse.user.name),
  });
}
