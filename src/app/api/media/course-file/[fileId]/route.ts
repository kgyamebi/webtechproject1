import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db/client";
import { readUpload } from "@/server/media/storage";

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }
  const { fileId } = await context.params;
  const file = await prisma.courseFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }
  const staff = await prisma.courseStaff.findUnique({
    where: { courseId_userId: { courseId: file.courseId, userId: session.user.id } },
  });
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: file.courseId, userId: session.user.id } },
  });
  if (!staff && !enrollment) {
    return new NextResponse(null, { status: 404 });
  }
  const stored = await readUpload(file.filePath);
  if (!stored) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { "Content-Type": stored.contentType, "Content-Disposition": `inline; filename="${file.title.replace(/"/g, "")}"` },
  });
}
