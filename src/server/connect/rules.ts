/**
 * Random Connect rules. Eligibility is decided here, before any database write.
 * A higher score means more overlapping preferences. It is not a compatibility claim.
 */

export const CONNECT_MODES = ["SURPRISE", "SAME_CAMPUS", "STUDY", "INTERESTS", "CAREER", "GLOBAL"] as const;

export type ConnectMode = (typeof CONNECT_MODES)[number];

export const CONNECT_SESSION_STATUSES = ["MATCH_FOUND", "SESSION_ACTIVE", "COMPLETED", "CANCELLED", "RESTRICTED"] as const;

export type ConnectSessionStatus = (typeof CONNECT_SESSION_STATUSES)[number];

export type ConnectEvent = "JOIN" | "END" | "RESTRICT";

export type ConnectProfile = {
  interests: string[];
  subjects: string[];
  careerInterests: string[];
  projectGoals: string[];
  language: string;
  studyIntent: string;
  institutionId: string | null;
};

const WEIGHTS = {
  interest: 3,
  subject: 2,
  career: 2,
  project: 1,
  language: 2,
};

export function normaliseTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function sharedTags(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map(normaliseTag).filter(Boolean));
  const seen = new Set<string>();
  const shared: string[] = [];
  for (const tag of left) {
    const key = normaliseTag(tag);
    if (!key || seen.has(key) || !rightSet.has(key)) {
      continue;
    }
    seen.add(key);
    shared.push(key);
  }
  return shared;
}

export function randomConnectAllowed(band: "adult" | "minor"): boolean {
  return band === "adult";
}

export function canEnterQueue(input: {
  band: "adult" | "minor";
  suspended: boolean;
  alreadyHeld: boolean;
  available: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!randomConnectAllowed(input.band)) {
    return { ok: false, reason: "Random Connect is closed for under-18 accounts." };
  }
  if (input.suspended) {
    return { ok: false, reason: "This account cannot join Random Connect right now." };
  }
  if (input.alreadyHeld) {
    return { ok: false, reason: "Finish or leave your current conversation first." };
  }
  if (!input.available) {
    return { ok: false, reason: "Turn on availability before joining the queue." };
  }
  return { ok: true };
}

export function pairEligible(input: {
  samePerson: boolean;
  viewerBand: "adult" | "minor";
  candidateBand: "adult" | "minor";
  blocked: boolean;
  viewerSuspended: boolean;
  candidateSuspended: boolean;
  candidateHeld: boolean;
  recentlyPaired: boolean;
  mode: ConnectMode;
  viewer: ConnectProfile;
  candidate: ConnectProfile;
}): { ok: true } | { ok: false; reason: string } {
  if (input.samePerson) {
    return { ok: false, reason: "You cannot match with yourself." };
  }
  if (!randomConnectAllowed(input.viewerBand) || !randomConnectAllowed(input.candidateBand)) {
    return { ok: false, reason: "Random Connect stays inside the adult age group." };
  }
  if (input.viewerBand !== input.candidateBand) {
    return { ok: false, reason: "Age groups are not matched together." };
  }
  if (input.blocked) {
    return { ok: false, reason: "A block prevents this match." };
  }
  if (input.viewerSuspended || input.candidateSuspended) {
    return { ok: false, reason: "One of these accounts is restricted." };
  }
  if (input.candidateHeld) {
    return { ok: false, reason: "That person is already in a conversation." };
  }
  if (input.recentlyPaired) {
    return { ok: false, reason: "You were matched with this person recently." };
  }

  if (input.mode === "SAME_CAMPUS") {
    if (!input.viewer.institutionId || input.viewer.institutionId !== input.candidate.institutionId) {
      return { ok: false, reason: "Same Campus needs two people at the same institution." };
    }
  }
  if (input.mode === "GLOBAL") {
    if (!input.viewer.institutionId || !input.candidate.institutionId || input.viewer.institutionId === input.candidate.institutionId) {
      return { ok: false, reason: "Global Connect looks outside your own institution." };
    }
  }
  if (input.mode === "INTERESTS" && sharedTags(input.viewer.interests, input.candidate.interests).length === 0) {
    return { ok: false, reason: "Shared Interests needs at least one interest in common." };
  }
  if (input.mode === "STUDY") {
    const subjects = sharedTags(input.viewer.subjects, input.candidate.subjects);
    const intent = normaliseTag(input.viewer.studyIntent) && normaliseTag(input.viewer.studyIntent) === normaliseTag(input.candidate.studyIntent);
    if (subjects.length === 0 && !intent) {
      return { ok: false, reason: "Study Buddy needs a shared subject or the same study intent." };
    }
  }
  if (input.mode === "CAREER") {
    const careers = sharedTags(input.viewer.careerInterests, input.candidate.careerInterests);
    const projects = sharedTags(input.viewer.projectGoals, input.candidate.projectGoals);
    if (careers.length === 0 && projects.length === 0) {
      return { ok: false, reason: "Career Connect needs a shared ambition or project goal." };
    }
  }
  return { ok: true };
}

export function scorePair(viewer: ConnectProfile, candidate: ConnectProfile): { score: number; reasons: string[] } {
  const interests = sharedTags(viewer.interests, candidate.interests);
  const subjects = sharedTags(viewer.subjects, candidate.subjects);
  const careers = sharedTags(viewer.careerInterests, candidate.careerInterests);
  const projects = sharedTags(viewer.projectGoals, candidate.projectGoals);
  const reasons: string[] = [];
  let score = 0;
  if (interests.length > 0) {
    score += WEIGHTS.interest * interests.length;
    reasons.push(...interests.slice(0, 3));
  }
  if (subjects.length > 0) {
    score += WEIGHTS.subject * subjects.length;
    reasons.push(...subjects.slice(0, 2));
  }
  if (careers.length > 0) {
    score += WEIGHTS.career * careers.length;
  }
  if (projects.length > 0) {
    score += WEIGHTS.project * projects.length;
  }
  if (viewer.language && normaliseTag(viewer.language) === normaliseTag(candidate.language)) {
    score += WEIGHTS.language;
  }
  return { score, reasons: reasons.slice(0, 3) };
}

/**
 * Everyone who passed the hard rules keeps a chance. A higher score is more
 * likely, and a score of zero can still be chosen. The caller supplies random()
 * so tests can force an outcome.
 */
export function pickWeighted<T extends { id: string; score: number }>(candidates: T[], random: () => number): T | null {
  if (candidates.length === 0) {
    return null;
  }
  const weights = candidates.map((candidate) => candidate.score + 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.min(Math.max(random(), 0), 0.999999) * total;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor < 0) {
      return candidates[index] ?? null;
    }
  }
  return candidates[candidates.length - 1] ?? null;
}

export function nextConnectStatus(current: ConnectSessionStatus, event: ConnectEvent): ConnectSessionStatus | null {
  if (current === "COMPLETED" || current === "CANCELLED" || current === "RESTRICTED") {
    return null;
  }
  if (event === "RESTRICT") {
    return "RESTRICTED";
  }
  if (event === "JOIN" && current === "MATCH_FOUND") {
    return "SESSION_ACTIVE";
  }
  if (event === "END" && (current === "MATCH_FOUND" || current === "SESSION_ACTIVE")) {
    return current === "MATCH_FOUND" ? "CANCELLED" : "COMPLETED";
  }
  return null;
}

export function validateConnectMessage(body: string, recentCount: number, limit = 20): { ok: true; body: string } | { ok: false; reason: string } {
  const text = body.trim();
  if (!text) {
    return { ok: false, reason: "Write a message before sending." };
  }
  if (text.length > 500) {
    return { ok: false, reason: "Keep a message under 500 characters." };
  }
  if (recentCount >= limit) {
    return { ok: false, reason: "You are sending messages too quickly." };
  }
  return { ok: true, body: text };
}

export function validateReportReason(reason: string): { ok: true; reason: string } | { ok: false; reason: string } {
  const text = reason.trim();
  if (text.length < 5 || text.length > 500) {
    return { ok: false, reason: "Describe the concern in 5 to 500 characters." };
  }
  return { ok: true, reason: text };
}

export const REPORT_CATEGORIES = [
  "HARASSMENT",
  "BULLYING",
  "THREATS",
  "IMPERSONATION",
  "SEXUAL_HARASSMENT",
  "INAPPROPRIATE",
  "SPAM",
  "AGE_CONCERN",
  "OTHER",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export function sessionOpen(status: ConnectSessionStatus): boolean {
  return status === "MATCH_FOUND" || status === "SESSION_ACTIVE";
}
