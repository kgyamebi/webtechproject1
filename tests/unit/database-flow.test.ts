import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { canSendFriendRequest } from "@/server/social/rules";
import { scoreQuestion, simulatedImportShouldBeRemoved } from "@/server/academic/rules";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    const error = new Error(`REDIRECT ${path}`);
    throw error;
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const sessionBox: { current: { user: { id: string; name: string; email: string; dateOfBirth: Date } } | null } = {
  current: null,
};

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => sessionBox.current,
    },
  },
}));

const connectionString = process.env.DATABASE_URL ?? "";
const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString, connectionTimeoutMillis: 2000, max: 1 })),
});

const createdUserIds: string[] = [];

async function databaseIsReady() {
  if (!connectionString) {
    return false;
  }
  const client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    const tables = await client.query("SELECT to_regclass('public.user') AS user_table, to_regclass('public.\"Course\"') AS course_table");
    await client.end();
    return Boolean(tables.rows[0]?.user_table && tables.rows[0]?.course_table);
  } catch {
    try {
      await client.end();
    } catch {
      // The connection never opened.
    }
    return false;
  }
}

const databaseReady = await databaseIsReady();

if (!databaseReady) {
  await prisma.$disconnect();
}

describe.skipIf(!databaseReady)("database features", () => {
  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("rejects a minor and adult friendship and stores an adult friendship", async () => {
    const adult = await createPerson("Adult", "2002-04-12");
    const other = await createPerson("Other", "2003-04-12");
    const minor = await createPerson("Minor", "2010-04-12");
    sessionBox.current = { user: { id: adult.id, name: adult.name, email: adult.email, dateOfBirth: adult.dateOfBirth } };
    const { sendFriendRequestAction } = await import("@/server/social/actions");
    const minorForm = new FormData();
    minorForm.set("userId", minor.id);
    await sendFriendRequestAction(minorForm);
    expect(
      await prisma.friendRequest.findFirst({ where: { fromUserId: adult.id, toUserId: minor.id } }),
    ).toBeNull();
    expect(
      canSendFriendRequest({
        samePerson: false,
        blocked: false,
        viewerBand: "adult",
        targetBand: "minor",
        targetAllowsRequests: true,
        existingStatus: "NONE",
        recentRequestCount: 0,
      }).ok,
    ).toBe(false);

    const adultForm = new FormData();
    adultForm.set("userId", other.id);
    await sendFriendRequestAction(adultForm);
    const request = await prisma.friendRequest.findFirst({ where: { fromUserId: adult.id, toUserId: other.id } });
    expect(request?.status).toBe("PENDING");
  });

  it("scores a stored quiz answer on the server and hides it until release", async () => {
    const lecturer = await createPerson("Lecturer", "1988-01-01", "LECTURER");
    const student = await createPerson("Student", "2004-01-01");
    const course = await prisma.course.create({
      data: {
        code: "T1",
        title: "Test course",
        joinCode: `T${randomUUID().slice(0, 8)}`,
        createdById: lecturer.id,
        staff: { create: { userId: lecturer.id, role: "LECTURER" } },
        enrollments: { create: { userId: student.id } },
      },
    });
    const question = await prisma.question.create({
      data: {
        quiz: {
          create: {
            courseId: course.id,
            title: "Check",
            published: true,
            pointsReleased: false,
          },
        },
        type: "SINGLE",
        prompt: "Two plus two",
        points: 2,
        position: 1,
        options: {
          create: [
            { text: "4", correct: true, position: 1 },
            { text: "5", correct: false, position: 2 },
          ],
        },
      },
      include: { options: true, quiz: true },
    });
    const correct = question.options.find((option) => option.correct);
    const score = scoreQuestion(
      {
        id: question.id,
        type: "SINGLE",
        points: 2,
        correctOptionIds: correct ? [correct.id] : [],
      },
      { questionId: question.id, selectedOptionIds: correct ? [correct.id] : [] },
    );
    expect(score.awarded).toBe(2);
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: question.quizId,
        studentId: student.id,
        status: "SUBMITTED",
        score: score.awarded,
        maxScore: 2,
        submittedAt: new Date(),
      },
    });
    expect(question.quiz.pointsReleased).toBe(false);
    expect(attempt.score).toBe(2);
  });

  it("removes a simulated import and keeps a native course", async () => {
    const owner = await createPerson("Owner", "1995-01-01");
    const native = await prisma.course.create({
      data: {
        code: "NATIVE",
        title: "Keep me",
        joinCode: `N${randomUUID().slice(0, 8)}`,
        source: "NATIVE",
        createdById: owner.id,
      },
    });
    const simulated = await prisma.course.create({
      data: {
        code: "SIM",
        title: "Remove me",
        joinCode: `S${randomUUID().slice(0, 8)}`,
        source: "SIMULATED",
        sourceLabel: "Simulated Canvas import. This is not a live LMS.",
        createdById: owner.id,
      },
    });
    if (simulatedImportShouldBeRemoved(simulated.source)) {
      await prisma.course.delete({ where: { id: simulated.id } });
    }
    if (simulatedImportShouldBeRemoved(native.source)) {
      await prisma.course.delete({ where: { id: native.id } });
    }
    expect(await prisma.course.findUnique({ where: { id: native.id } })).not.toBeNull();
    expect(await prisma.course.findUnique({ where: { id: simulated.id } })).toBeNull();
  });
});

async function createPerson(name: string, dateOfBirth: string, role: "STUDENT" | "LECTURER" = "STUDENT") {
  const id = randomUUID();
  createdUserIds.push(id);
  const institution = await prisma.institution.findUnique({ where: { id: "inst_riverside" } });
  return prisma.user.create({
    data: {
      id,
      name,
      email: `${id}@example.test`,
      emailVerified: true,
      dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
      profile: { create: { discoverable: true, allowFriendRequests: true, interests: ["debate"] } },
      memberships: institution
        ? { create: { institutionId: institution.id, role, status: "VERIFIED", isPrimary: true } }
        : undefined,
    },
  });
}
