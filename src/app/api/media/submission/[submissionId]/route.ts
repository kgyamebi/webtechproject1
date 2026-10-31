import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canReadSubmission } from "@/server/academic/rules";
import { prisma } from "@/server/db/client";
import { readUpload } from "@/server/media/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const { submissionId } = await context.params;
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  if (!submission?.filePath) {
    return new NextResponse(null, { status: 404 });
  }

  const staff = await prisma.courseStaff.findUnique({
    where: { courseId_userId: { courseId: submission.assignment.courseId, userId: session.user.id } },
  });
  if (!canReadSubmission({ isStaff: Boolean(staff), isOwner: submission.studentId === session.user.id })) {
    return new NextResponse(null, { status: 404 });
  }

  const file = await readUpload(submission.filePath);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "attachment",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
