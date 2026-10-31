/**
 * Academic rules. Scores are calculated here so a browser cannot submit its own mark.
 * A browser quiz cannot stop a determined student from cheating. This engine records
 * a fair server-side score. It is not a locked examination hall.
 */

export type QuestionType = "SINGLE" | "MULTIPLE" | "TRUE_FALSE" | "SHORT" | "NUMERICAL" | "ESSAY";

export type GradedQuestion = {
  id: string;
  type: QuestionType;
  points: number;
  correctOptionIds: string[];
  correctText?: string | null;
  numericalAnswer?: number | null;
  numericalTolerance?: number | null;
};

export type SubmittedAnswer = {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer?: string | null;
};

export type QuestionScore = {
  questionId: string;
  awarded: number | null;
  manual: boolean;
};

export function normaliseAnswerText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

export function scoreQuestion(question: GradedQuestion, answer: SubmittedAnswer | undefined): QuestionScore {
  if (question.type === "ESSAY") {
    return { questionId: question.id, awarded: null, manual: true };
  }

  if (!answer) {
    return { questionId: question.id, awarded: 0, manual: false };
  }

  let correct = false;

  if (question.type === "SINGLE" || question.type === "TRUE_FALSE" || question.type === "MULTIPLE") {
    correct = sameSet(answer.selectedOptionIds, question.correctOptionIds);
  }

  if (question.type === "SHORT") {
    correct = normaliseAnswerText(answer.textAnswer ?? "") === normaliseAnswerText(question.correctText ?? "");
  }

  if (question.type === "NUMERICAL") {
    const value = Number(answer.textAnswer);
    const expected = question.numericalAnswer;
    const tolerance = question.numericalTolerance ?? 0;
    correct = expected !== null && expected !== undefined && Number.isFinite(value) && Math.abs(value - expected) <= tolerance;
  }

  return {
    questionId: question.id,
    awarded: correct ? question.points : 0,
    manual: false,
  };
}

export function objectiveTotal(scores: QuestionScore[]): { points: number; maxAuto: number; pendingManual: boolean } {
  let points = 0;
  let pendingManual = false;
  for (const score of scores) {
    if (score.manual || score.awarded === null) {
      pendingManual = true;
      continue;
    }
    points += score.awarded;
  }
  return { points, maxAuto: points, pendingManual };
}

export function objectiveMax(questions: GradedQuestion[]): number {
  return questions.filter((question) => question.type !== "ESSAY").reduce((sum, question) => sum + question.points, 0);
}

export function canStartAttempt(input: {
  published: boolean;
  now: Date;
  openAt: Date | null;
  closeAt: Date | null;
  attemptCount: number;
  attemptLimit: number;
  hasOpenAttempt: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.published) {
    return { ok: false, reason: "This quiz is not published." };
  }
  if (input.openAt && input.now < input.openAt) {
    return { ok: false, reason: "This quiz is not open yet." };
  }
  if (input.closeAt && input.now > input.closeAt) {
    return { ok: false, reason: "This quiz has closed." };
  }
  if (input.hasOpenAttempt) {
    return { ok: false, reason: "You already have an attempt in progress." };
  }
  if (input.attemptCount >= input.attemptLimit) {
    return { ok: false, reason: "You have used every attempt." };
  }
  return { ok: true };
}

export function attemptExpired(startedAt: Date, now: Date, timeLimitMinutes: number | null, closeAt: Date | null): boolean {
  if (closeAt && now > closeAt) {
    return true;
  }
  if (timeLimitMinutes === null) {
    return false;
  }
  return now.getTime() > startedAt.getTime() + timeLimitMinutes * 60_000;
}

export function submissionAccepted(now: Date, dueAt: Date, allowLate: boolean): { ok: true; late: boolean } | { ok: false; reason: string } {
  const late = now.getTime() > dueAt.getTime();
  if (late && !allowLate) {
    return { ok: false, reason: "The deadline has passed." };
  }
  return { ok: true, late };
}

export type ReleasedScore = { points: number; maxPoints: number };

export function categoryPercent(items: ReleasedScore[]): number | null {
  const max = items.reduce((sum, item) => sum + item.maxPoints, 0);
  if (max <= 0) {
    return null;
  }
  const points = items.reduce((sum, item) => sum + item.points, 0);
  return (points / max) * 100;
}

/**
 * Categories with no released work are left out, and the remaining weights are scaled
 * so a missing category does not silently count as zero.
 */
export function weightedTotal(categories: Array<{ weight: number; percent: number | null }>): number | null {
  const included = categories.filter((category) => category.percent !== null && category.weight > 0);
  const weightSum = included.reduce((sum, category) => sum + category.weight, 0);
  if (weightSum <= 0) {
    return null;
  }
  const total = included.reduce((sum, category) => sum + category.weight * (category.percent ?? 0), 0);
  return Math.round((total / weightSum) * 10) / 10;
}

export function canReadGrade(input: { isStaff: boolean; isOwner: boolean; released: boolean }): boolean {
  if (input.isStaff) {
    return true;
  }
  return input.isOwner && input.released;
}

export function canReadSubmission(input: { isStaff: boolean; isOwner: boolean }): boolean {
  return input.isStaff || input.isOwner;
}

export function viewerCanSeeContent(input: {
  isAuthor: boolean;
  blocked: boolean;
  audience: "CONNECTIONS" | "COMMUNITY" | "COURSE" | "UNIVERSITY";
  isFriend: boolean;
  inCommunity: boolean;
  inCourse: boolean;
  sameInstitution: boolean;
  expired?: boolean;
}): boolean {
  if (input.expired) {
    return false;
  }
  if (input.isAuthor) {
    return true;
  }
  if (input.blocked) {
    return false;
  }
  if (input.audience === "CONNECTIONS") {
    return input.isFriend;
  }
  if (input.audience === "COMMUNITY") {
    return input.inCommunity;
  }
  if (input.audience === "COURSE") {
    return input.inCourse;
  }
  return input.sameInstitution;
}

export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function simulatedImportShouldBeRemoved(source: "NATIVE" | "SIMULATED"): boolean {
  return source === "SIMULATED";
}
