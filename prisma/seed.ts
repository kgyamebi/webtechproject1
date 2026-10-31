import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const password = "Campus-seed-2026";

const institutions = [
  {
    id: "inst_riverside",
    name: "University of Riverside",
    kind: "UNIVERSITY" as const,
    emailDomains: ["riverside.edu"],
    country: "Ghana",
  },
  {
    id: "inst_northbridge",
    name: "Northbridge Technical University",
    kind: "TECHNICAL_UNIVERSITY" as const,
    emailDomains: ["northbridge.tech"],
    country: "Ghana",
  },
  {
    id: "inst_harbour",
    name: "Harbour Senior High",
    kind: "SENIOR_HIGH" as const,
    emailDomains: ["harbourhigh.edu"],
    country: "Ghana",
  },
];

const people = [
  {
    name: "Ada Mensah",
    email: "ada.mensah@riverside.edu",
    dateOfBirth: "2002-04-12",
    platformRole: "USER" as const,
    institutionId: "inst_riverside",
    role: "STUDENT" as const,
    status: "DOMAIN_MATCHED" as const,
    discoverable: true,
  },
  {
    name: "Leila Osei",
    email: "leila.osei@riverside.edu",
    dateOfBirth: "2009-06-01",
    platformRole: "USER" as const,
    institutionId: "inst_riverside",
    role: "STUDENT" as const,
    status: "DOMAIN_MATCHED" as const,
    discoverable: false,
  },
  {
    name: "Samuel Boateng",
    email: "samuel.boateng@riverside.edu",
    dateOfBirth: "1988-11-03",
    platformRole: "USER" as const,
    institutionId: "inst_riverside",
    role: "LECTURER" as const,
    status: "VERIFIED" as const,
    discoverable: false,
  },
  {
    name: "Ama Darko",
    email: "ama.darko@gmail.com",
    dateOfBirth: "2004-01-19",
    platformRole: "USER" as const,
    institutionId: "inst_riverside",
    role: "STUDENT" as const,
    status: "PENDING" as const,
    discoverable: true,
  },
  {
    name: "Platform Admin",
    email: "platform.admin@campusplus.local",
    dateOfBirth: "1990-02-02",
    platformRole: "PLATFORM_ADMIN" as const,
    institutionId: null,
    role: "STUDENT" as const,
    status: "PENDING" as const,
    discoverable: false,
  },
];

async function main() {
  for (const institution of institutions) {
    await prisma.institution.upsert({
      where: { id: institution.id },
      update: institution,
      create: institution,
    });
  }

  const passwordHash = await hashPassword(password);

  for (const person of people) {
    const existing = await prisma.user.findUnique({ where: { email: person.email } });
    if (existing) {
      continue;
    }

    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        name: person.name,
        email: person.email,
        emailVerified: true,
        dateOfBirth: new Date(`${person.dateOfBirth}T00:00:00.000Z`),
        platformRole: person.platformRole,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            password: passwordHash,
          },
        },
        profile: {
          create: {
            discoverable: person.discoverable,
            showEmail: false,
          },
        },
        memberships: person.institutionId
          ? {
              create: {
                institutionId: person.institutionId,
                role: person.role,
                status: person.status,
                isPrimary: true,
              },
            }
          : undefined,
      },
    });
  }

  await seedCampus();
}

async function seedCampus() {
  const ada = await prisma.user.findUnique({ where: { email: "ada.mensah@riverside.edu" } });
  const ama = await prisma.user.findUnique({ where: { email: "ama.darko@gmail.com" } });
  const leila = await prisma.user.findUnique({ where: { email: "leila.osei@riverside.edu" } });
  const samuel = await prisma.user.findUnique({ where: { email: "samuel.boateng@riverside.edu" } });
  if (!ada || !ama || !leila || !samuel) {
    return;
  }

  await prisma.profile.update({
    where: { userId: ada.id },
    data: {
      interests: ["debate"],
      subjects: ["law"],
      projectGoals: ["moot court"],
      careerInterests: ["policy"],
      programme: "Law",
      discoverable: true,
    },
  });
  await prisma.profile.update({
    where: { userId: ama.id },
    data: {
      interests: ["debate"],
      subjects: ["law"],
      projectGoals: ["moot court"],
      careerInterests: ["policy"],
      programme: "Law",
      discoverable: true,
    },
  });
  await prisma.profile.update({
    where: { userId: leila.id },
    data: { discoverable: false, interests: ["debate"], subjects: ["law"] },
  });

  for (const personId of [ada.id, ama.id]) {
    await prisma.connectPreference.upsert({
      where: { userId: personId },
      update: { available: true, language: "English", mode: "SURPRISE", studyIntent: "exam prep" },
      create: { userId: personId, available: true, language: "English", mode: "SURPRISE", studyIntent: "exam prep" },
    });
  }

  await prisma.friendRequest.upsert({
    where: { fromUserId_toUserId: { fromUserId: ada.id, toUserId: ama.id } },
    update: { status: "ACCEPTED" },
    create: { fromUserId: ada.id, toUserId: ama.id, status: "ACCEPTED" },
  });

  const course = await prisma.course.upsert({
    where: { joinCode: "RIVER1" },
    update: { title: "Web Technologies", description: "Campus+ course used by the seed data." },
    create: {
      code: "WEB101",
      title: "Web Technologies",
      description: "A native Campus+ course. Joining the university does not enrol you automatically.",
      joinCode: "RIVER1",
      institutionId: "inst_riverside",
      source: "NATIVE",
      createdById: samuel.id,
      staff: { create: { userId: samuel.id, role: "LECTURER" } },
    },
  });

  for (const studentId of [ada.id, ama.id, leila.id]) {
    await prisma.enrollment.upsert({
      where: { courseId_userId: { courseId: course.id, userId: studentId } },
      update: {},
      create: { courseId: course.id, userId: studentId },
    });
  }

  const category = await prisma.gradeCategory.upsert({
    where: { courseId_name: { courseId: course.id, name: "Coursework" } },
    update: { weight: 100 },
    create: { courseId: course.id, name: "Coursework", weight: 100 },
  });

  const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.assignment.upsert({
    where: { id: "seed_assignment_web" },
    update: { published: true, dueAt },
    create: {
      id: "seed_assignment_web",
      courseId: course.id,
      title: "Build a personal page",
      instructions: "Write a short plan for a page you would publish.",
      dueAt,
      published: true,
      allowLate: false,
      maxPoints: 20,
      categoryId: category.id,
    },
  });

  const quiz = await prisma.quiz.upsert({
    where: { id: "seed_quiz_web" },
    update: { published: true },
    create: {
      id: "seed_quiz_web",
      courseId: course.id,
      title: "HTML check",
      instructions: "Scored on the server. This is not a locked exam.",
      published: true,
      attemptLimit: 2,
      categoryId: category.id,
      closeAt: dueAt,
    },
  });

  const existingQuestion = await prisma.question.findFirst({ where: { quizId: quiz.id } });
  if (!existingQuestion) {
    const question = await prisma.question.create({
      data: {
        quizId: quiz.id,
        type: "SINGLE",
        prompt: "Which tag marks a paragraph?",
        points: 2,
        position: 1,
      },
    });
    await prisma.questionOption.createMany({
      data: [
        { questionId: question.id, text: "p", correct: true, position: 1 },
        { questionId: question.id, text: "div", correct: false, position: 2 },
      ],
    });
  }

  const community = await prisma.community.upsert({
    where: { id: "seed_community_web" },
    update: {},
    create: {
      id: "seed_community_web",
      name: "Web Technologies circle",
      description: "A public community for the seeded course.",
      visibility: "PUBLIC",
      courseId: course.id,
      institutionId: "inst_riverside",
      createdById: ada.id,
      members: { create: { userId: ada.id, role: "MODERATOR" } },
    },
  });
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId: community.id, userId: ama.id } },
    update: { pending: false },
    create: { communityId: community.id, userId: ama.id, pending: false },
  });

  await prisma.campusEvent.upsert({
    where: { id: "seed_event_fair" },
    update: {},
    create: {
      id: "seed_event_fair",
      title: "Riverside project fair",
      description: "An official campus event from the seed data.",
      kind: "campus",
      startsAt: dueAt,
      location: "Main hall",
      official: true,
      createdById: samuel.id,
      institutionId: "inst_riverside",
    },
  });

  await prisma.opportunity.upsert({
    where: { id: "seed_opportunity_intern" },
    update: {},
    create: {
      id: "seed_opportunity_intern",
      title: "Campus web internship",
      description: "A sample listing. The link is a public page, not an application inside Campus+.",
      kind: "internship",
      url: "https://example.com/internship",
      official: true,
      createdById: samuel.id,
    },
  });

  const conversation = await prisma.conversation.findFirst({
    where: {
      kind: "DIRECT",
      AND: [{ members: { some: { userId: ada.id } } }, { members: { some: { userId: ama.id } } }],
    },
  });
  if (!conversation) {
    await prisma.conversation.create({
      data: {
        kind: "DIRECT",
        createdById: ada.id,
        members: { create: [{ userId: ada.id }, { userId: ama.id }] },
        messages: { create: { senderId: ada.id, body: "See you at the project fair." } },
      },
    });
  }

}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
