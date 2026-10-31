import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { viewerCanSeeContent } from "@/server/academic/rules";
import { prisma } from "@/server/db/client";
import { readUpload } from "@/server/media/storage";
import { areFriends, blockedBetween, sameInstitution } from "@/server/social/relations";

export async function GET(
  _request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const { postId } = await context.params;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post?.imagePath) {
    return new NextResponse(null, { status: 404 });
  }

  const userId = session.user.id;
  const [member, enrollment, staff] = await Promise.all([
    post.communityId
      ? prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId: post.communityId, userId } },
        })
      : Promise.resolve(null),
    post.courseId
      ? prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: post.courseId, userId } } })
      : Promise.resolve(null),
    post.courseId
      ? prisma.courseStaff.findUnique({ where: { courseId_userId: { courseId: post.courseId, userId } } })
      : Promise.resolve(null),
  ]);
  const allowed = viewerCanSeeContent({
    isAuthor: post.authorId === userId,
    blocked: post.authorId !== userId && (await blockedBetween(userId, post.authorId)),
    audience: post.audience,
    isFriend: post.authorId === userId || (await areFriends(userId, post.authorId)),
    inCommunity: Boolean(member && !member.pending),
    inCourse: Boolean(enrollment) || Boolean(staff),
    sameInstitution: await sameInstitution(userId, post.authorId),
  });
  if (!allowed) {
    return new NextResponse(null, { status: 404 });
  }

  const file = await readUpload(post.imagePath);
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
