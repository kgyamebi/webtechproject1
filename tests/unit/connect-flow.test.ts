import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

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

const sessionBox: {
  current: { user: { id: string; name: string; email: string; dateOfBirth: Date; platformRole: "USER" | "PLATFORM_ADMIN" } } | null;
} = { current: null };

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
const createdSessionIds: string[] = [];
const createdCaseIds: string[] = [];

async function databaseIsReady() {
  if (!connectionString) {
    return false;
  }
  const client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    const tables = await client.query(`SELECT to_regclass('public."ConnectSession"') AS connect_session`);
    await client.end();
    return Boolean(tables.rows[0]?.connect_session);
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

describe.skipIf(!databaseReady)("Random Connect persistence", () => {
  afterAll(async () => {
    if (createdCaseIds.length > 0) {
      await prisma.moderationCase.deleteMany({ where: { id: { in: createdCaseIds } } });
    }
    if (createdUserIds.length > 0) {
      const leftover = await prisma.connectParticipant.findMany({
        where: { userId: { in: createdUserIds } },
        select: { sessionId: true },
      });
      for (const row of leftover) {
        createdSessionIds.push(row.sessionId);
      }
    }
    if (createdSessionIds.length > 0) {
      await prisma.connectSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("matches two adults once, keeps a retried message, and refuses an outsider", async () => {
    const topic = `shared-${randomUUID()}`;
    const left = await createPerson("Left", "2002-04-12", topic);
    const right = await createPerson("Right", "2002-04-12", topic);
    const outsider = await createAdult("Outsider");
    const { enterQueue, postMessage, endSession } = await import("@/server/connect/engine");

    await enterQueue({ userId: left.id, band: "adult", mode: "INTERESTS" });
    await enterQueue({ userId: right.id, band: "adult", mode: "INTERESTS" });
    let holds = await prisma.connectHold.findMany({ where: { userId: { in: [left.id, right.id] } } });
    if (holds.length < 2) {
      await enterQueue({ userId: left.id, band: "adult", mode: "INTERESTS" });
      await enterQueue({ userId: right.id, band: "adult", mode: "INTERESTS" });
      holds = await prisma.connectHold.findMany({ where: { userId: { in: [left.id, right.id] } } });
    }

    expect(holds).toHaveLength(2);
    expect(holds[0]?.sessionId).toBe(holds[1]?.sessionId);
    const sessionId = holds[0]?.sessionId ?? "";
    createdSessionIds.push(sessionId);

    const again = await enterQueue({ userId: left.id, band: "adult", mode: "INTERESTS" });
    expect(again.ok).toBe(false);

    await postMessage({ userId: left.id, sessionId, body: "hello", clientKey: "same-key" });
    await postMessage({ userId: left.id, sessionId, body: "hello again", clientKey: "same-key" });
    const outsiderResult = await postMessage({ userId: outsider.id, sessionId, body: "nope", clientKey: "other-key" });
    expect(outsiderResult.ok).toBe(false);
    expect(await prisma.connectMessage.count({ where: { sessionId } })).toBe(1);

    await endSession(left.id, sessionId);
    const closed = await prisma.connectSession.findUnique({ where: { id: sessionId } });
    expect(closed?.status).toBe("COMPLETED");
    expect(await prisma.connectHold.count({ where: { sessionId } })).toBe(0);
  }, 20000);

  it("does not match a blocked person or a minor", async () => {
    const left = await createAdult("Blocker");
    const right = await createAdult("Blocked");
    const minor = await createPerson("Minor", "2010-04-12", "minor-topic");
    await prisma.profile.update({ where: { userId: left.id }, data: { interests: ["blocked-topic"] } });
    await prisma.profile.update({ where: { userId: right.id }, data: { interests: ["blocked-topic"] } });
    await prisma.block.create({ data: { blockerId: left.id, blockedId: right.id } });
    const { enterQueue } = await import("@/server/connect/engine");

    await enterQueue({ userId: left.id, band: "adult", mode: "INTERESTS" });
    const result = await enterQueue({ userId: right.id, band: "adult", mode: "INTERESTS" });
    expect(result).toEqual({ ok: true, waiting: true });
    const minorResult = await enterQueue({ userId: minor.id, band: "minor", mode: "SURPRISE" });
    expect(minorResult.ok).toBe(false);
    expect(await prisma.connectHold.count({ where: { userId: { in: [left.id, right.id, minor.id] } } })).toBe(0);
  }, 20000);

  it("keeps moderation closed to ordinary accounts", async () => {
    const reporter = await createAdult("Reporter");
    const target = await createAdult("Target");
    const session = await prisma.connectSession.create({
      data: {
        mode: "SURPRISE",
        status: "SESSION_ACTIVE",
        participants: {
          create: [
            { userId: reporter.id, alias: "Guest REPO" },
            { userId: target.id, alias: "Guest TARG" },
          ],
        },
      },
    });
    createdSessionIds.push(session.id);
    const report = await prisma.report.create({
      data: { reporterId: reporter.id, targetType: "CONNECT_SESSION", targetId: session.id, reason: "Harassment in the chat" },
    });
    const record = await prisma.moderationCase.create({ data: { reportId: report.id } });
    createdCaseIds.push(record.id);

    sessionBox.current = {
      user: { id: reporter.id, name: reporter.name, email: reporter.email, dateOfBirth: reporter.dateOfBirth, platformRole: "USER" },
    };
    const { moderateCaseAction } = await import("@/server/connect/actions");
    const form = new FormData();
    form.set("caseId", record.id);
    form.set("kind", "CLOSE");
    form.set("note", "should not apply");
    await moderateCaseAction(form);
    expect((await prisma.moderationCase.findUnique({ where: { id: record.id } }))?.status).toBe("OPEN");

    sessionBox.current = {
      user: { id: reporter.id, name: reporter.name, email: reporter.email, dateOfBirth: reporter.dateOfBirth, platformRole: "PLATFORM_ADMIN" },
    };
    form.set("kind", "SUSPEND");
    form.set("note", "review hold");
    await moderateCaseAction(form);
    expect(await prisma.accountRestriction.findUnique({ where: { userId: target.id } })).not.toBeNull();
    expect((await prisma.moderationCase.findUnique({ where: { id: record.id } }))?.status).toBe("OPEN");
  }, 20000);
});

async function createAdult(name: string) {
  return createPerson(name, "2002-04-12", `topic-${randomUUID()}`);
}

async function createPerson(name: string, dateOfBirth: string, interest: string) {
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
      profile: { create: { discoverable: true, interests: [interest], subjects: ["law"] } },
      connectPreference: { create: { available: true, language: "English", mode: "SURPRISE" } },
      memberships: institution
        ? { create: { institutionId: institution.id, role: "STUDENT", status: "VERIFIED", isPrimary: true } }
        : undefined,
    },
  });
}
