/**
 * Social rules that do not touch the database.
 * Discovery weights are design parameters, not measured science.
 */

import { socialInteractionAllowed, type AgeBand } from "@/server/identity/policy";

export const DISCOVERY_WEIGHTS = {
  interest: 3,
  subject: 2,
  projectGoal: 2,
  skill: 1,
  career: 1,
  community: 1,
} as const;

export type TagProfile = {
  interests: string[];
  skills: string[];
  subjects: string[];
  projectGoals: string[];
  careerInterests: string[];
  communityIds: string[];
};

export type MatchExplanation = {
  score: number;
  reasons: string[];
};

export function normaliseTags(values: string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const tag = value.trim().toLowerCase();
    if (tag) {
      seen.add(tag);
    }
  }
  return [...seen];
}

export function parseTagList(value: string): string[] {
  return normaliseTags(value.split(","));
}

function shared(left: string[], right: string[]): string[] {
  const rightSet = new Set(normaliseTags(right));
  return normaliseTags(left).filter((item) => rightSet.has(item));
}

export function explainMatch(left: TagProfile, right: TagProfile): MatchExplanation {
  const reasons: string[] = [];
  let score = 0;

  const pairs: Array<[string, string[], string[], number]> = [
    ["interests", left.interests, right.interests, DISCOVERY_WEIGHTS.interest],
    ["subjects", left.subjects, right.subjects, DISCOVERY_WEIGHTS.subject],
    ["project goals", left.projectGoals, right.projectGoals, DISCOVERY_WEIGHTS.projectGoal],
    ["skills", left.skills, right.skills, DISCOVERY_WEIGHTS.skill],
    ["career interests", left.careerInterests, right.careerInterests, DISCOVERY_WEIGHTS.career],
    ["communities", left.communityIds, right.communityIds, DISCOVERY_WEIGHTS.community],
  ];

  for (const [label, a, b, weight] of pairs) {
    const overlap = shared(a, b);
    if (overlap.length > 0) {
      score += overlap.length * weight;
      reasons.push(`Shared ${label}: ${overlap.join(", ")}`);
    }
  }

  return { score, reasons };
}

export function canRecommend(input: {
  samePerson: boolean;
  viewerBand: AgeBand;
  candidateBand: AgeBand;
  candidateDiscoverable: boolean;
  blocked: boolean;
  hidden: boolean;
  skipped: boolean;
  alreadyFriends: boolean;
}): boolean {
  if (input.samePerson || input.blocked || input.hidden || input.skipped || input.alreadyFriends) {
    return false;
  }
  if (!input.candidateDiscoverable) {
    return false;
  }
  return socialInteractionAllowed(input.viewerBand, input.candidateBand);
}

export function canSendFriendRequest(input: {
  samePerson: boolean;
  blocked: boolean;
  viewerBand: AgeBand;
  targetBand: AgeBand;
  targetAllowsRequests: boolean;
  existingStatus: "NONE" | "PENDING" | "ACCEPTED" | "DECLINED";
  recentRequestCount: number;
  limit?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.samePerson) {
    return { ok: false, reason: "You cannot add yourself." };
  }
  if (input.blocked) {
    return { ok: false, reason: "This person is not available." };
  }
  if (!socialInteractionAllowed(input.viewerBand, input.targetBand)) {
    return { ok: false, reason: "Campus+ does not open social contact between minors and adults." };
  }
  if (!input.targetAllowsRequests) {
    return { ok: false, reason: "This person is not accepting friend requests." };
  }
  if (input.existingStatus === "ACCEPTED") {
    return { ok: false, reason: "You are already friends." };
  }
  if (input.existingStatus === "PENDING") {
    return { ok: false, reason: "A request is already waiting." };
  }
  if (input.recentRequestCount >= (input.limit ?? 20)) {
    return { ok: false, reason: "You have sent too many requests. Try again later." };
  }
  return { ok: true };
}

export function eitherBlocked(leftBlockedRight: boolean, rightBlockedLeft: boolean): boolean {
  return leftBlockedRight || rightBlockedLeft;
}

export const QUIET_STATUSES = [
  "WAITING",
  "INTRODUCTION_CREATED",
  "ACTIVE",
  "REVEAL_REQUESTED",
  "REVEALED",
  "ENDED",
  "REPORTED",
] as const;

export type QuietStatus = (typeof QUIET_STATUSES)[number];

export type QuietEvent =
  | "MATCH"
  | "ACCEPT"
  | "DECLINE"
  | "ASK_REVEAL"
  | "CONSENT_REVEAL"
  | "REJECT_REVEAL"
  | "END"
  | "REPORT";

/**
 * Both people must consent before a real name is shown.
 * A reveal does not create a friendship.
 */
export function nextQuietStatus(
  current: QuietStatus,
  event: QuietEvent,
  actorIsRequester: boolean,
): QuietStatus | null {
  if (event === "REPORT" && current !== "ENDED") {
    return "REPORTED";
  }
  if (event === "END" && current !== "REPORTED" && current !== "ENDED") {
    return "ENDED";
  }
  if (event === "DECLINE" && current === "INTRODUCTION_CREATED") {
    return "ENDED";
  }

  const table: Record<string, QuietStatus> = {
    "WAITING:MATCH": "INTRODUCTION_CREATED",
    "INTRODUCTION_CREATED:ACCEPT": "ACTIVE",
    "ACTIVE:ASK_REVEAL": "REVEAL_REQUESTED",
    "REVEAL_REQUESTED:REJECT_REVEAL": "ACTIVE",
  };

  if (current === "REVEAL_REQUESTED" && event === "CONSENT_REVEAL") {
    return actorIsRequester ? null : "REVEALED";
  }

  return table[`${current}:${event}`] ?? null;
}

export function quietLabel(input: {
  status: QuietStatus;
  viewerIsA: boolean;
  aliasA: string;
  aliasB: string;
  nameA: string;
  nameB: string;
}): string {
  if (input.status === "REVEALED") {
    return input.viewerIsA ? input.nameB : input.nameA;
  }
  return input.viewerIsA ? input.aliasB : input.aliasA;
}

export function applyQuietAccept(
  status: QuietStatus,
  viewerIsA: boolean,
  acceptedA: boolean,
  acceptedB: boolean,
): { status: QuietStatus; acceptedA: boolean; acceptedB: boolean } | null {
  if (status !== "INTRODUCTION_CREATED") {
    return null;
  }
  const nextA = viewerIsA ? true : acceptedA;
  const nextB = viewerIsA ? acceptedB : true;
  return {
    status: nextA && nextB ? "ACTIVE" : "INTRODUCTION_CREATED",
    acceptedA: nextA,
    acceptedB: nextB,
  };
}

export function canUseQuietConnect(input: {
  band: AgeBand;
  optedIn: boolean;
  blocked: boolean;
}): boolean {
  return input.band === "adult" && input.optedIn && !input.blocked;
}
