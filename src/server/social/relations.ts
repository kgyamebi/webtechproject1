import "server-only";

import { prisma } from "@/server/db/client";
export async function blockedBetween(leftId: string, rightId: string): Promise<boolean> {
  const rows = await prisma.block.findMany({
    where: {
      OR: [
        { blockerId: leftId, blockedId: rightId },
        { blockerId: rightId, blockedId: leftId },
      ],
    },
    select: { id: true },
  });
  return rows.length > 0;
}

export async function areFriends(leftId: string, rightId: string): Promise<boolean> {
  const row = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { fromUserId: leftId, toUserId: rightId },
        { fromUserId: rightId, toUserId: leftId },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function friendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    select: { fromUserId: true, toUserId: true },
  });
  return rows.map((row) => (row.fromUserId === userId ? row.toUserId : row.fromUserId));
}

export async function sameInstitution(leftId: string, rightId: string): Promise<boolean> {
  const memberships = await prisma.institutionMembership.findMany({
    where: { userId: { in: [leftId, rightId] }, isPrimary: true },
    select: { userId: true, institutionId: true },
  });
  const left = memberships.find((item) => item.userId === leftId);
  const right = memberships.find((item) => item.userId === rightId);
  return Boolean(left && right && left.institutionId === right.institutionId);
}
