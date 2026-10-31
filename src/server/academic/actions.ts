"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db/client";
import { saveUpload } from "@/server/media/storage";
import { notifyUser } from "@/server/notifications";
import {
  attemptExpired,
  canReadGrade,
  canReadSubmission,
  canStartAttempt,
  categoryPercent,
  objectiveMax,
  safeHttpUrl,
  scoreQuestion,
  submissionAccepted,
  weightedTotal,
  type GradedQuestion,
} from "@/server/academic/rules";

function refresh(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

function joinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

async function courseAccess(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      staff: { where: { userId } },
      enrollments: { where: { userId } },
    },
  });
  if (!course) {
    return null;
  }
  const isStaff = course.staff.length > 0;
  const enrolled = course.enrollments.length > 0;
  if (!isStaff && !enrolled) {
    return null;
  }
  return { course, isStaff, enrolled };
}

async function requireLecturer() {
  const viewer = await requireUser();
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewer.userId }, select: { platformRole: true } }),
    prisma.institutionMembership.findFirst({ where: { userId: viewer.userId, isPrimary: true } }),
  ]);
  if (user?.platformRole !== "PLATFORM_ADMIN" && membership?.role !== "LECTURER") {
    return null;
  }
  return viewer;
}

export async function listCourses() {
  const { userId } = await requireUser();
  const teaching = await prisma.course.findMany({
    where: { staff: { some: { userId } }, source: "NATIVE" },
    orderBy: { title: "asc" },
    include: { _count: { select: { enrollments: true } } },
  });
  const progress = {
    modules: {
      include: {
        materials: { include: { completions: { where: { userId }, select: { userId: true } } } },
      },
    },
    assignments: {
      where: { published: true },
      include: { submissions: { where: { studentId: userId }, select: { id: true } } },
    },
  };
  const studying = await prisma.course.findMany({
    where: { enrollments: { some: { userId } }, staff: { none: { userId } }, source: "NATIVE" },
    orderBy: { title: "asc" },
    include: progress,
  });
  const samples = await prisma.course.findMany({
    where: {
      source: "SIMULATED",
      OR: [{ enrollments: { some: { userId } } }, { staff: { some: { userId } } }],
    },
    orderBy: { title: "asc" },
    include: progress,
  });
  return { teaching, studying, samples };
}

export async function createCourseAction(formData: FormData) {
  const viewer = await requireLecturer();
  if (!viewer) {
    return;
  }
  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (code.length < 2 || title.length < 2) {
    return;
  }
  const membership = await prisma.institutionMembership.findFirst({
    where: { userId: viewer.userId, isPrimary: true },
  });
  const course = await prisma.course.create({
    data: {
      code,
      title,
      description: String(formData.get("description") ?? "").slice(0, 1000),
      joinCode: joinCode(),
      institutionId: membership?.institutionId,
      source: "NATIVE",
      createdById: viewer.userId,
      staff: { create: { userId: viewer.userId, role: "LECTURER" } },
    },
  });
  redirect(`/workspace/learn/${course.id}`);
}

export async function joinCourseAction(formData: FormData) {
  const { userId } = await requireUser();
  const code = String(formData.get("joinCode") ?? "").trim().toUpperCase();
  const course = await prisma.course.findUnique({ where: { joinCode: code } });
  if (!course || course.archived || course.source === "SIMULATED") {
    return;
  }
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: course.id, userId } },
    update: {},
    create: { courseId: course.id, userId },
  });
  redirect(`/workspace/learn/${course.id}`);
}

export async function enrollStudentAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseAccess(viewer.userId, courseId);
  if (!access?.isStaff) {
    return;
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const student = await prisma.user.findUnique({ where: { email } });
  if (!student) {
    return;
  }
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId, userId: student.id } },
    update: {},
    create: { courseId, userId: student.id },
  });
  await notifyUser({
    userId: student.id,
    kind: "ENROLLMENT",
    title: "You were added to a course",
    body: access.course.title,
    href: `/workspace/learn/${courseId}`,
    preference: "notifyAcademic",
  });
  refresh([`/workspace/learn/${courseId}`]);
}

export async function archiveCourseAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseAccess(viewer.userId, courseId);
  if (!access?.isStaff) {
    return;
  }
  await prisma.course.update({ where: { id: courseId }, data: { archived: !access.course.archived } });
  refresh([`/workspace/learn/${courseId}`, "/workspace/learn"]);
}

export async function loadCourse(courseId: string) {
  const viewer = await requireUser();
  const access = await courseAccess(viewer.userId, courseId);
  if (!access) {
    return null;
  }
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          materials: {
            include: { completions: { where: { userId: viewer.userId } } },
          },
        },
      },
      assignments: {
        orderBy: { dueAt: "asc" },
        include: {
          submissions: {
            where: access.isStaff ? {} : { studentId: viewer.userId },
            include: { student: { select: { id: true, name: true } } },
          },
        },
      },
      quizzes: {
        orderBy: { createdAt: "asc" },
        include: {
          attempts: {
            where: access.isStaff ? {} : { studentId: viewer.userId },
            select: { id: true, status: true, score: true, studentId: true },
          },
        },
      },
      announcements: { orderBy: { createdAt: "desc" }, take: 12 },
      enrollments: { include: { user: { select: { id: true, name: true, email: true } } } },
      staff: { include: { user: { select: { id: true, name: true } } } },
      studyGroups: { include: { members: true } },
      gradeCategories: { orderBy: { name: "asc" } },
    },
  });
  if (!course) {
    return null;
  }
  return {
    course: {
      ...course,
      assignments: course.assignments.filter((assignment) => access.isStaff || assignment.published),
      quizzes: course.quizzes.filter((quiz) => access.isStaff || quiz.published),
    },
    isStaff: access.isStaff,
    viewerId: viewer.userId,
  };
}

export async function addModuleAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const access = await courseAccess(viewer.userId, courseId);
  if (!access?.isStaff || title.length < 2) {
    return;
  }
  const count = await prisma.module.count({ where: { courseId } });
  await prisma.module.create({
    data: { courseId, title, position: count + 1, gate: formData.get("gate") === "on" },
  });
  refresh([`/workspace/learn/${courseId}`]);
}

export async function setModuleGateAction(formData: FormData) {
  const viewer = await requireUser();
  const moduleId = String(formData.get("moduleId") ?? "");
  const courseModule = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!courseModule) {
    return;
  }
  const access = await courseAccess(viewer.userId, courseModule.courseId);
  if (!access?.isStaff) {
    return;
  }
  await prisma.module.update({
    where: { id: moduleId },
    data: { gate: formData.get("gate") === "on" },
  });
  refresh([`/workspace/learn/${courseModule.courseId}`]);
}

export async function addMaterialAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const moduleId = String(formData.get("moduleId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const access = await courseAccess(viewer.userId, courseId);
  const courseModule = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!access?.isStaff || !courseModule || courseModule.courseId !== courseId || title.length < 2) {
    return;
  }
  const url = safeHttpUrl(String(formData.get("url") ?? ""));
  await prisma.material.create({ data: { moduleId, title, url } });
  refresh([`/workspace/learn/${courseId}`]);
}

export async function completeMaterialAction(formData: FormData) {
  const viewer = await requireUser();
  const materialId = String(formData.get("materialId") ?? "");
  const material = await prisma.material.findUnique({ include: { module: true }, where: { id: materialId } });
  if (!material) {
    return;
  }
  const access = await courseAccess(viewer.userId, material.module.courseId);
  if (!access?.enrolled && !access?.isStaff) {
    return;
  }
  if (!access.isStaff && material.module.gate) {
    const previous = await prisma.module.findFirst({
      where: { courseId: material.module.courseId, position: { lt: material.module.position } },
      orderBy: { position: "desc" },
      include: { materials: { include: { completions: { where: { userId: viewer.userId }, select: { userId: true } } } } },
    });
    const unfinished = previous?.materials.some((item) => item.completions.length === 0) ?? false;
    if (previous && previous.materials.length > 0 && unfinished) {
      return;
    }
  }
  await prisma.materialCompletion.upsert({
    where: { materialId_userId: { materialId, userId: viewer.userId } },
    update: {},
    create: { materialId, userId: viewer.userId },
  });
  refresh([`/workspace/learn/${material.module.courseId}`]);
}

export async function createAssignmentAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseAccess(viewer.userId, courseId);
  const title = String(formData.get("title") ?? "").trim();
  const dueAt = new Date(String(formData.get("dueAt") ?? ""));
  if (!access?.isStaff || title.length < 2 || Number.isNaN(dueAt.getTime())) {
    return;
  }
  const maxPoints = Number(formData.get("maxPoints") ?? 100);
  await prisma.assignment.create({
    data: {
      courseId,
      title,
      instructions: String(formData.get("instructions") ?? "").slice(0, 4000),
      dueAt,
      published: formData.get("published") === "on",
      allowLate: formData.get("allowLate") === "on",
      maxPoints: Number.isFinite(maxPoints) && maxPoints > 0 ? Math.round(maxPoints) : 100,
      categoryId: String(formData.get("categoryId") ?? "") || null,
    },
  });
  refresh([`/workspace/learn/${courseId}`]);
}

export async function loadAssignment(courseId: string, assignmentId: string) {
  const viewer = await requireUser();
  const access = await courseAccess(viewer.userId, courseId);
  if (!access) {
    return null;
  }
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      submissions: {
        where: access.isStaff ? {} : { studentId: viewer.userId },
        include: { student: { select: { id: true, name: true } } },
      },
    },
  });
  if (!assignment || assignment.courseId !== courseId || (!assignment.published && !access.isStaff)) {
    return null;
  }
  return { assignment, isStaff: access.isStaff, viewerId: viewer.userId, archived: access.course.archived };
}

export async function submitAssignmentAction(formData: FormData) {
  const viewer = await requireUser();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || !assignment.published) {
    return;
  }
  const access = await courseAccess(viewer.userId, assignment.courseId);
  if (!access?.enrolled || access.course.archived) {
    return;
  }
  const decision = submissionAccepted(new Date(), assignment.dueAt, assignment.allowLate);
  if (!decision.ok) {
    return;
  }
  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: viewer.userId } },
  });
  if (existing?.points !== null && existing?.points !== undefined) {
    return;
  }
  const body = String(formData.get("body") ?? "").slice(0, 8000);
  let filePath: string | undefined;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      filePath = await saveUpload(viewer.userId, new Uint8Array(await file.arrayBuffer()));
    } catch {
      return;
    }
  }
  if (!body.trim() && !filePath) {
    return;
  }
  await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: viewer.userId } },
    update: { body, filePath: filePath ?? existing?.filePath, submittedAt: new Date(), late: decision.late },
    create: {
      assignmentId,
      studentId: viewer.userId,
      body,
      filePath,
      late: decision.late,
    },
  });
  refresh([`/workspace/learn/${assignment.courseId}/assignments/${assignmentId}`]);
}

export async function gradeSubmissionAction(formData: FormData) {
  const viewer = await requireUser();
  const submissionId = String(formData.get("submissionId") ?? "");
  const submission = await prisma.submission.findUnique({ include: { assignment: true }, where: { id: submissionId } });
  if (!submission) {
    return;
  }
  const access = await courseAccess(viewer.userId, submission.assignment.courseId);
  if (!access?.isStaff || !canReadSubmission({ isStaff: true, isOwner: submission.studentId === viewer.userId })) {
    return;
  }
  const points = Number(formData.get("points"));
  if (!Number.isFinite(points) || points < 0 || points > submission.assignment.maxPoints) {
    return;
  }
  const released = formData.get("released") === "on";
  await prisma.submission.update({
    where: { id: submissionId },
    data: { points, feedback: String(formData.get("feedback") ?? "").slice(0, 2000), released },
  });
  await prisma.gradeRecord.deleteMany({
    where: { courseId: submission.assignment.courseId, studentId: submission.studentId, sourceType: "ASSIGNMENT", sourceId: submission.assignmentId },
  });
  await prisma.gradeRecord.create({
    data: {
      courseId: submission.assignment.courseId,
      studentId: submission.studentId,
      sourceType: "ASSIGNMENT",
      sourceId: submission.assignmentId,
      points,
      maxPoints: submission.assignment.maxPoints,
      released,
      feedback: String(formData.get("feedback") ?? "").slice(0, 2000),
    },
  });
  if (released) {
    await notifyUser({
      userId: submission.studentId,
      kind: "GRADE",
      title: "A grade was released",
      body: submission.assignment.title,
      href: `/workspace/learn/${submission.assignment.courseId}/grades`,
      preference: "notifyAcademic",
    });
  }
  refresh([
    `/workspace/learn/${submission.assignment.courseId}/assignments/${submission.assignmentId}`,
    `/workspace/learn/${submission.assignment.courseId}/grades`,
  ]);
}

export async function createQuizAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseAccess(viewer.userId, courseId);
  const title = String(formData.get("title") ?? "").trim();
  if (!access?.isStaff || title.length < 2) {
    return;
  }
  const attemptLimit = Number(formData.get("attemptLimit") ?? 1);
  const timeLimit = String(formData.get("timeLimitMinutes") ?? "");
  const quiz = await prisma.quiz.create({
    data: {
      courseId,
      title,
      instructions: String(formData.get("instructions") ?? "").slice(0, 2000),
      attemptLimit: Number.isFinite(attemptLimit) && attemptLimit > 0 ? Math.round(attemptLimit) : 1,
      timeLimitMinutes: timeLimit ? Number(timeLimit) : null,
      openAt: formData.get("openAt") ? new Date(String(formData.get("openAt"))) : null,
      closeAt: formData.get("closeAt") ? new Date(String(formData.get("closeAt"))) : null,
      categoryId: String(formData.get("categoryId") ?? "") || null,
      shuffleQuestions: formData.get("shuffleQuestions") === "on",
    },
  });
  redirect(`/workspace/learn/${courseId}/quizzes/${quiz.id}`);
}

export async function addQuestionAction(formData: FormData) {
  const viewer = await requireUser();
  const quizId = String(formData.get("quizId") ?? "");
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: true } });
  if (!quiz) {
    return;
  }
  const access = await courseAccess(viewer.userId, quiz.courseId);
  const attempts = await prisma.quizAttempt.count({ where: { quizId } });
  const prompt = String(formData.get("prompt") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const points = Number(formData.get("points") ?? 1);
  const allowed = ["SINGLE", "MULTIPLE", "TRUE_FALSE", "SHORT", "NUMERICAL", "ESSAY"];
  if (!access?.isStaff || attempts > 0 || !allowed.includes(type) || prompt.length < 2) {
    return;
  }
  const question = await prisma.question.create({
    data: {
      quizId,
      type: type as "SINGLE" | "MULTIPLE" | "TRUE_FALSE" | "SHORT" | "NUMERICAL" | "ESSAY",
      prompt,
      points: Number.isFinite(points) && points > 0 ? Math.round(points) : 1,
      position: quiz.questions.length + 1,
      correctText: type === "SHORT" ? String(formData.get("correctText") ?? "").trim() : null,
      numericalAnswer: type === "NUMERICAL" ? Number(formData.get("numericalAnswer")) : null,
      numericalTolerance: type === "NUMERICAL" ? Number(formData.get("numericalTolerance") ?? 0) : null,
    },
  });
  if (type === "TRUE_FALSE") {
    const correct = String(formData.get("correctText") ?? "true");
    await prisma.questionOption.createMany({
      data: [
        { questionId: question.id, text: "True", correct: correct === "true", position: 1 },
        { questionId: question.id, text: "False", correct: correct === "false", position: 2 },
      ],
    });
  }
  if (type === "SINGLE" || type === "MULTIPLE") {
    const correctIndexes = new Set(formData.getAll("correct").map(String));
    const options = [1, 2, 3, 4]
      .map((position) => ({
        position,
        text: String(formData.get(`option${position}`) ?? "").trim(),
        correct: correctIndexes.has(String(position)),
      }))
      .filter((option) => option.text);
    if (options.length < 2 || !options.some((option) => option.correct)) {
      await prisma.question.delete({ where: { id: question.id } });
      return;
    }
    await prisma.questionOption.createMany({
      data: options.map((option) => ({ questionId: question.id, ...option })),
    });
  }
  refresh([`/workspace/learn/${quiz.courseId}/quizzes/${quizId}`]);
}

export async function publishQuizAction(formData: FormData) {
  const viewer = await requireUser();
  const quizId = String(formData.get("quizId") ?? "");
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: true } });
  if (!quiz || quiz.questions.length === 0) {
    return;
  }
  const access = await courseAccess(viewer.userId, quiz.courseId);
  if (!access?.isStaff) {
    return;
  }
  await prisma.quiz.update({ where: { id: quizId }, data: { published: true } });
  refresh([`/workspace/learn/${quiz.courseId}/quizzes/${quizId}`, `/workspace/learn/${quiz.courseId}`]);
}

function toGraded(question: {
  id: string;
  type: GradedQuestion["type"];
  points: number;
  correctText: string | null;
  numericalAnswer: number | null;
  numericalTolerance: number | null;
  options: Array<{ id: string; correct: boolean }>;
}): GradedQuestion {
  return {
    id: question.id,
    type: question.type,
    points: question.points,
    correctOptionIds: question.options.filter((option) => option.correct).map((option) => option.id),
    correctText: question.correctText,
    numericalAnswer: question.numericalAnswer,
    numericalTolerance: question.numericalTolerance,
  };
}

export async function startQuizAction(formData: FormData) {
  const viewer = await requireUser();
  const quizId = String(formData.get("quizId") ?? "");
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { attempts: { where: { studentId: viewer.userId } } } });
  if (!quiz) {
    return;
  }
  const access = await courseAccess(viewer.userId, quiz.courseId);
  if (!access?.enrolled || access.course.archived) {
    return;
  }
  const decision = canStartAttempt({
    published: quiz.published,
    now: new Date(),
    openAt: quiz.openAt,
    closeAt: quiz.closeAt,
    attemptCount: quiz.attempts.filter((attempt) => attempt.status === "SUBMITTED").length,
    attemptLimit: quiz.attemptLimit,
    hasOpenAttempt: quiz.attempts.some((attempt) => attempt.status === "IN_PROGRESS"),
  });
  if (!decision.ok) {
    return;
  }
  await prisma.quizAttempt.create({ data: { quizId, studentId: viewer.userId } });
  redirect(`/workspace/learn/${quiz.courseId}/quizzes/${quizId}`);
}

export async function submitQuizAction(formData: FormData) {
  const viewer = await requireUser();
  const attemptId = String(formData.get("attemptId") ?? "");
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { quiz: { include: { questions: { include: { options: true } } } } },
  });
  if (!attempt || attempt.studentId !== viewer.userId || attempt.status !== "IN_PROGRESS") {
    return;
  }
  const closed = attemptExpired(attempt.startedAt, new Date(), attempt.quiz.timeLimitMinutes, attempt.quiz.closeAt);
  if (closed && attempt.quiz.closeAt && Date.now() > attempt.quiz.closeAt.getTime() + 24 * 60 * 60 * 1000) {
    return;
  }
  const scores = attempt.quiz.questions.map((question) => {
    const selected = formData.getAll(`opt_${question.id}`).map(String);
    const text = String(formData.get(`text_${question.id}`) ?? "");
    return scoreQuestion(toGraded(question), { questionId: question.id, selectedOptionIds: selected, textAnswer: text });
  });
  const maxScore = objectiveMax(attempt.quiz.questions.map(toGraded)) + attempt.quiz.questions.filter((question) => question.type === "ESSAY").reduce((sum, question) => sum + question.points, 0);
  const auto = scores.reduce((sum, score) => sum + (score.awarded ?? 0), 0);
  await prisma.$transaction([
    prisma.attemptAnswer.deleteMany({ where: { attemptId } }),
    prisma.attemptAnswer.createMany({
      data: scores.map((score) => ({
        attemptId,
        questionId: score.questionId,
        selectedOptionIds: formData.getAll(`opt_${score.questionId}`).map(String),
        textAnswer: String(formData.get(`text_${score.questionId}`) ?? "") || null,
        awardedPoints: score.awarded,
      })),
    }),
    prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { status: "SUBMITTED", submittedAt: new Date(), score: auto, maxScore },
    }),
  ]);
  refresh([`/workspace/learn/${attempt.quiz.courseId}/quizzes/${attempt.quizId}`]);
}

export async function gradeEssayAction(formData: FormData) {
  const viewer = await requireUser();
  const answerId = String(formData.get("answerId") ?? "");
  const answer = await prisma.attemptAnswer.findUnique({
    where: { id: answerId },
    include: { attempt: { include: { quiz: { include: { questions: true } }, answers: true } } },
  });
  if (!answer) {
    return;
  }
  const access = await courseAccess(viewer.userId, answer.attempt.quiz.courseId);
  const question = answer.attempt.quiz.questions.find((item) => item.id === answer.questionId);
  if (!access?.isStaff || !question) {
    return;
  }
  const points = Number(formData.get("points"));
  if (!Number.isFinite(points) || points < 0 || points > question.points) {
    return;
  }
  await prisma.attemptAnswer.update({
    where: { id: answerId },
    data: { awardedPoints: points, feedback: String(formData.get("feedback") ?? "").slice(0, 1000) },
  });
  const answers = await prisma.attemptAnswer.findMany({ where: { attemptId: answer.attemptId } });
  const score = answers.reduce((sum, item) => sum + (item.awardedPoints ?? 0), 0);
  await prisma.quizAttempt.update({ where: { id: answer.attemptId }, data: { score } });
  refresh([`/workspace/learn/${answer.attempt.quiz.courseId}/quizzes/${answer.attempt.quizId}`]);
}

export async function releaseQuizAction(formData: FormData) {
  const viewer = await requireUser();
  const quizId = String(formData.get("quizId") ?? "");
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { attempts: { where: { status: "SUBMITTED" }, include: { answers: true } }, questions: true },
  });
  if (!quiz) {
    return;
  }
  const access = await courseAccess(viewer.userId, quiz.courseId);
  if (!access?.isStaff) {
    return;
  }
  const pending = quiz.attempts.some((attempt) => attempt.answers.some((answer) => answer.awardedPoints === null));
  if (pending) {
    return;
  }
  const releasePoints = formData.get("pointsReleased") === "on";
  const releaseAnswers = formData.get("answersReleased") === "on";
  await prisma.quiz.update({
    where: { id: quizId },
    data: { pointsReleased: releasePoints, answersReleased: releaseAnswers },
  });
  if (releasePoints) {
    for (const attempt of quiz.attempts) {
      await prisma.gradeRecord.deleteMany({
        where: { sourceType: "QUIZ", sourceId: quizId, studentId: attempt.studentId },
      });
      await prisma.gradeRecord.create({
        data: {
          courseId: quiz.courseId,
          studentId: attempt.studentId,
          sourceType: "QUIZ",
          sourceId: quizId,
          points: attempt.score ?? 0,
          maxPoints: attempt.maxScore ?? 0,
          released: true,
        },
      });
      await notifyUser({
        userId: attempt.studentId,
        kind: "GRADE",
        title: "Quiz results were released",
        body: quiz.title,
        href: `/workspace/learn/${quiz.courseId}/grades`,
        preference: "notifyAcademic",
      });
    }
  }
  refresh([`/workspace/learn/${quiz.courseId}/quizzes/${quizId}`, `/workspace/learn/${quiz.courseId}/grades`]);
}

export async function loadQuiz(courseId: string, quizId: string) {
  const viewer = await requireUser();
  const access = await courseAccess(viewer.userId, courseId);
  if (!access) {
    return null;
  }
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } },
      attempts: {
        where: access.isStaff ? {} : { studentId: viewer.userId },
        orderBy: { startedAt: "desc" },
        include: { answers: true, student: { select: { id: true, name: true } } },
      },
    },
  });
  if (!quiz || quiz.courseId !== courseId || (!quiz.published && !access.isStaff)) {
    return null;
  }
  const reveal = access.isStaff || quiz.answersReleased;
  const questions = quiz.questions.map((question) => ({
    ...question,
    correctText: reveal ? question.correctText : null,
    numericalAnswer: reveal ? question.numericalAnswer : null,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
      position: option.position,
      correct: reveal ? option.correct : false,
    })),
  }));
  return { quiz: { ...quiz, questions }, isStaff: access.isStaff, viewerId: viewer.userId, revealAnswers: reveal };
}

export async function loadGrades(courseId: string) {
  const viewer = await requireUser();
  const access = await courseAccess(viewer.userId, courseId);
  if (!access) {
    return null;
  }
  const categories = await prisma.gradeCategory.findMany({ where: { courseId } });
  const records = await prisma.gradeRecord.findMany({
    where: { courseId, ...(access.isStaff ? {} : { studentId: viewer.userId }) },
    orderBy: { recordedAt: "desc" },
  });
  const assignments = await prisma.assignment.findMany({ where: { courseId }, select: { id: true, title: true, categoryId: true, maxPoints: true } });
  const quizzes = await prisma.quiz.findMany({ where: { courseId }, select: { id: true, title: true, categoryId: true } });
  const visible = records.filter((record) =>
    canReadGrade({ isStaff: access.isStaff, isOwner: record.studentId === viewer.userId, released: record.released }),
  );
  const names = new Map<string, { title: string; categoryId: string | null }>();
  for (const item of assignments) {
    names.set(item.id, item);
  }
  for (const item of quizzes) {
    names.set(item.id, item);
  }
  const byCategory = categories.map((category) => {
    const items = visible
      .filter((record) => names.get(record.sourceId)?.categoryId === category.id && record.studentId === (access.isStaff ? record.studentId : viewer.userId))
      .map((record) => ({ points: record.points, maxPoints: record.maxPoints }));
    return { name: category.name, weight: category.weight, percent: categoryPercent(items) };
  });
  const mine = visible.filter((record) => record.studentId === viewer.userId);
  const mineByCategory = categories.map((category) => ({
    weight: category.weight,
    percent: categoryPercent(
      mine
        .filter((record) => names.get(record.sourceId)?.categoryId === category.id)
        .map((record) => ({ points: record.points, maxPoints: record.maxPoints })),
    ),
  }));
  return {
    isStaff: access.isStaff,
    records: visible.map((record) => ({
      ...record,
      title: names.get(record.sourceId)?.title ?? record.sourceType,
    })),
    courseTotal: access.isStaff ? null : weightedTotal(mineByCategory),
    categories: byCategory,
    whatIf: access.isStaff
      ? []
      : categories.map((category) => ({
          name: category.name,
          weight: category.weight,
          items: mine
            .filter((record) => names.get(record.sourceId)?.categoryId === category.id)
            .map((record) => ({
              id: record.id,
              title: names.get(record.sourceId)?.title ?? record.sourceType,
              points: record.points,
              maxPoints: record.maxPoints,
            })),
        })),
  };
}

export async function addCategoryAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseAccess(viewer.userId, courseId);
  const name = String(formData.get("name") ?? "").trim();
  const weight = Number(formData.get("weight"));
  if (!access?.isStaff || name.length < 2 || !Number.isFinite(weight) || weight <= 0) {
    return;
  }
  await prisma.gradeCategory.upsert({
    where: { courseId_name: { courseId, name } },
    update: { weight: Math.round(weight) },
    create: { courseId, name, weight: Math.round(weight) },
  });
  refresh([`/workspace/learn/${courseId}`, `/workspace/learn/${courseId}/grades`]);
}

export async function announceAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseAccess(viewer.userId, courseId);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!access?.isStaff || title.length < 2 || body.length < 2) {
    return;
  }
  await prisma.announcement.create({ data: { courseId, authorId: viewer.userId, title, body: body.slice(0, 2000) } });
  const students = await prisma.enrollment.findMany({ where: { courseId } });
  for (const student of students) {
    await notifyUser({
      userId: student.userId,
      kind: "ANNOUNCEMENT",
      title,
      body,
      href: `/workspace/learn/${courseId}`,
      preference: "notifyAcademic",
      mail: true,
    });
  }
  refresh([`/workspace/learn/${courseId}`]);
}

export async function createStudyGroupAction(formData: FormData) {
  const viewer = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  const access = await courseAccess(viewer.userId, courseId);
  const name = String(formData.get("name") ?? "").trim();
  if (!access || access.course.archived || name.length < 2) {
    return;
  }
  await prisma.studyGroup.create({
    data: { courseId, name, createdById: viewer.userId, members: { create: { userId: viewer.userId } } },
  });
  refresh([`/workspace/learn/${courseId}`]);
}

export async function joinStudyGroupAction(formData: FormData) {
  const viewer = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return;
  }
  const access = await courseAccess(viewer.userId, group.courseId);
  if (!access) {
    return;
  }
  await prisma.studyGroupMember.upsert({
    where: { groupId_userId: { groupId, userId: viewer.userId } },
    update: {},
    create: { groupId, userId: viewer.userId },
  });
  refresh([`/workspace/learn/${group.courseId}`]);
}

export async function listDeadlines() {
  const { userId } = await requireUser();
  const enrollments = await prisma.enrollment.findMany({ where: { userId }, select: { courseId: true } });
  const courseIds = enrollments.map((item) => item.courseId);
  const now = new Date();
  const assignments = await prisma.assignment.findMany({
    where: { courseId: { in: courseIds }, published: true, dueAt: { gte: now } },
    orderBy: { dueAt: "asc" },
    take: 8,
    include: { course: { select: { title: true } } },
  });
  const quizzes = await prisma.quiz.findMany({
    where: { courseId: { in: courseIds }, published: true, closeAt: { gte: now } },
    orderBy: { closeAt: "asc" },
    take: 8,
    include: { course: { select: { title: true } } },
  });
  return { assignments, quizzes };
}
