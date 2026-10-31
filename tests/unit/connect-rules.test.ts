import { describe, expect, it } from "vitest";
import {
  canEnterQueue,
  nextConnectStatus,
  pairEligible,
  pickWeighted,
  scorePair,
  validateConnectMessage,
  validateReportReason,
  type ConnectProfile,
} from "@/server/connect/rules";

const ada: ConnectProfile = {
  interests: ["debate"],
  subjects: ["law"],
  careerInterests: ["policy"],
  projectGoals: ["clinic"],
  language: "English",
  studyIntent: "exam prep",
  institutionId: "riverside",
};

const ama: ConnectProfile = {
  ...ada,
  institutionId: "northbridge",
};

const basePair = {
  samePerson: false,
  viewerBand: "adult" as const,
  candidateBand: "adult" as const,
  blocked: false,
  viewerSuspended: false,
  candidateSuspended: false,
  candidateHeld: false,
  recentlyPaired: false,
  viewer: ada,
  candidate: { ...ada },
};

describe("Random Connect eligibility", () => {
  it("keeps minors out of the queue and out of adult matches", () => {
    expect(canEnterQueue({ band: "minor", suspended: false, alreadyHeld: false, available: true }).ok).toBe(false);
    expect(pairEligible({ ...basePair, candidateBand: "minor", mode: "SURPRISE" }).ok).toBe(false);
  });

  it("applies mode rules before any score is used", () => {
    expect(pairEligible({ ...basePair, mode: "SAME_CAMPUS", candidate: ama }).ok).toBe(false);
    expect(pairEligible({ ...basePair, mode: "GLOBAL", candidate: ama }).ok).toBe(true);
    expect(pairEligible({ ...basePair, mode: "INTERESTS", candidate: { ...ama, interests: ["chess"] } }).ok).toBe(false);
    expect(pairEligible({ ...basePair, mode: "SURPRISE", blocked: true }).ok).toBe(false);
    expect(pairEligible({ ...basePair, mode: "SURPRISE", recentlyPaired: true }).ok).toBe(false);
  });

  it("ranks shared tags without treating the score as a guarantee", () => {
    const match = scorePair(ada, ama);
    expect(match.score).toBeGreaterThan(0);
    expect(match.reasons).toContain("debate");
  });

  it("can still choose a lower-scoring person", () => {
    const picked = pickWeighted(
      [
        { id: "high", score: 10 },
        { id: "low", score: 0 },
      ],
      () => 0.99,
    );
    expect(picked?.id).toBe("low");
  });

  it("rejects invalid session transitions and closed chats", () => {
    expect(nextConnectStatus("MATCH_FOUND", "JOIN")).toBe("SESSION_ACTIVE");
    expect(nextConnectStatus("SESSION_ACTIVE", "END")).toBe("COMPLETED");
    expect(nextConnectStatus("COMPLETED", "END")).toBeNull();
    expect(nextConnectStatus("SESSION_ACTIVE", "RESTRICT")).toBe("RESTRICTED");
  });

  it("limits messages and reports", () => {
    expect(validateConnectMessage("  hello  ", 0).ok).toBe(true);
    expect(validateConnectMessage("", 0).ok).toBe(false);
    expect(validateConnectMessage("hello", 20).ok).toBe(false);
    expect(validateReportReason("no").ok).toBe(false);
    expect(validateReportReason("This person sent threats.").ok).toBe(true);
  });
});
