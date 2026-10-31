import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db/client";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Sign in before downloading your data." }, { status: 401 });
  }

  const userId = session.user.id;
  const [profile, memberships, posts, enrollments, notifications] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.institutionMembership.findMany({
      where: { userId },
      include: { institution: { select: { id: true, name: true, kind: true } } },
    }),
    prisma.post.findMany({ where: { authorId: userId }, select: { id: true, body: true, audience: true, createdAt: true } }),
    prisma.enrollment.findMany({ where: { userId }, include: { course: { select: { id: true, code: true, title: true, source: true } } } }),
    prisma.notification.findMany({ where: { userId }, select: { id: true, kind: true, title: true, body: true, createdAt: true } }),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      dateOfBirth: session.user.dateOfBirth,
      platformRole: session.user.platformRole,
      createdAt: session.user.createdAt,
    },
    profile,
    memberships: memberships.map((membership) => ({
      role: membership.role,
      status: membership.status,
      isPrimary: membership.isPrimary,
      institution: membership.institution,
    })),
    posts,
    enrollments: enrollments.map((enrollment) => enrollment.course),
    notifications,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="campus-plus-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
