import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db/client";
import { readUpload } from "@/server/media/storage";

export async function GET(_request: Request, context: { params: Promise<{ communityId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }
  const { communityId } = await context.params;
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    include: { highlight: true, members: { where: { userId: session.user.id } } },
  });
  if (!community?.highlight) {
    return new NextResponse(null, { status: 404 });
  }
  const member = community.members[0];
  if (community.visibility === "PRIVATE" && (!member || member.pending) && community.createdById !== session.user.id) {
    return new NextResponse(null, { status: 404 });
  }
  const file = await readUpload(community.highlight.imagePath);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: { "content-type": file.contentType, "cache-control": "private, no-store" },
  });
}
