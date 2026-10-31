import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { viewerCanSeeContent } from "@/server/academic/rules";
import { prisma } from "@/server/db/client";
import { readUpload } from "@/server/media/storage";
import { areFriends, blockedBetween, sameInstitution } from "@/server/social/relations";

export async function GET(
  _request: Request,
  context: { params: Promise<{ storyId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const { storyId } = await context.params;
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) {
    return new NextResponse(null, { status: 404 });
  }

  const userId = session.user.id;
  const allowed = viewerCanSeeContent({
    isAuthor: story.authorId === userId,
    blocked: story.authorId !== userId && (await blockedBetween(userId, story.authorId)),
    audience: story.audience,
    isFriend: story.authorId === userId || (await areFriends(userId, story.authorId)),
    inCommunity: false,
    inCourse: false,
    sameInstitution: await sameInstitution(userId, story.authorId),
    expired: story.expiresAt <= new Date(),
  });
  if (!allowed) {
    return new NextResponse(null, { status: 404 });
  }

  const file = await readUpload(story.imagePath);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
