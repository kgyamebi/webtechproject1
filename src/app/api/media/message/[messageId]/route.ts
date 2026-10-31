import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db/client";
import { readUpload } from "@/server/media/storage";

export async function GET(_request: Request, context: { params: Promise<{ messageId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }
  const { messageId } = await context.params;
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message?.attachmentPath || message.deletedAt || message.visibleAt > new Date()) {
    return new NextResponse(null, { status: 404 });
  }
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId: session.user.id } },
  });
  if (!membership && message.senderId !== session.user.id) {
    return new NextResponse(null, { status: 404 });
  }
  const file = await readUpload(message.attachmentPath);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": message.kind === "voice" ? "inline" : `attachment; filename="${(message.attachmentName ?? "file").replace(/[^\w.\- ]/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
