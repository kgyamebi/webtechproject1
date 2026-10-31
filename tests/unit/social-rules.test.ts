import { describe, expect, it } from "vitest";
import {
  applyQuietAccept,
  canRecommend,
  canSendFriendRequest,
  explainMatch,
  nextQuietStatus,
  quietLabel,
} from "@/server/social/rules";

const ada = {
  interests: ["debate"],
  skills: ["writing"],
  subjects: ["law"],
  projectGoals: ["moot court"],
  careerInterests: ["policy"],
  communityIds: ["community-law"],
};

describe("discovery", () => {
  it("explains a match from shared tags and ignores empty overlap", () => {
    const match = explainMatch(ada, {
      ...ada,
      skills: ["drawing"],
      communityIds: [],
    });
    expect(match.score).toBe(3 + 2 + 2 + 1);
    expect(match.reasons.some((reason) => reason.includes("debate"))).toBe(true);
    expect(match.reasons.some((reason) => reason.includes("drawing"))).toBe(false);
  });

  it("hides minors from adults and respects skips, hides, and blocks", () => {
    expect(
      canRecommend({
        samePerson: false,
        viewerBand: "adult",
        candidateBand: "minor",
        candidateDiscoverable: true,
        blocked: false,
        hidden: false,
        skipped: false,
        alreadyFriends: false,
      }),
    ).toBe(false);
    expect(
      canRecommend({
        samePerson: false,
        viewerBand: "adult",
        candidateBand: "adult",
        candidateDiscoverable: true,
        blocked: false,
        hidden: true,
        skipped: false,
        alreadyFriends: false,
      }),
    ).toBe(false);
  });
});

describe("friend requests", () => {
  it("refuses duplicates, blocks, and a burst of requests", () => {
    expect(
      canSendFriendRequest({
        samePerson: false,
        blocked: true,
        viewerBand: "adult",
        targetBand: "adult",
        targetAllowsRequests: true,
        existingStatus: "NONE",
        recentRequestCount: 0,
      }).ok,
    ).toBe(false);
    expect(
      canSendFriendRequest({
        samePerson: false,
        blocked: false,
        viewerBand: "adult",
        targetBand: "adult",
        targetAllowsRequests: true,
        existingStatus: "PENDING",
        recentRequestCount: 0,
      }).ok,
    ).toBe(false);
    expect(
      canSendFriendRequest({
        samePerson: false,
        blocked: false,
        viewerBand: "adult",
        targetBand: "adult",
        targetAllowsRequests: true,
        existingStatus: "NONE",
        recentRequestCount: 20,
      }).ok,
    ).toBe(false);
  });
});

describe("Quiet Connect", () => {
  it("follows the allowed states and requires the other person to consent", () => {
    expect(nextQuietStatus("WAITING", "MATCH", false)).toBe("INTRODUCTION_CREATED");
    expect(nextQuietStatus("INTRODUCTION_CREATED", "ACCEPT", false)).toBe("ACTIVE");
    expect(nextQuietStatus("ACTIVE", "ASK_REVEAL", true)).toBe("REVEAL_REQUESTED");
    expect(nextQuietStatus("REVEAL_REQUESTED", "CONSENT_REVEAL", true)).toBeNull();
    expect(nextQuietStatus("REVEAL_REQUESTED", "CONSENT_REVEAL", false)).toBe("REVEALED");
    expect(nextQuietStatus("ACTIVE", "REPORT", false)).toBe("REPORTED");
  });

  it("keeps the real name hidden until both people have revealed", () => {
    const hidden = quietLabel({
      status: "ACTIVE",
      viewerIsA: true,
      aliasA: "Cedar",
      aliasB: "Maple",
      nameA: "Ada",
      nameB: "Ama",
    });
    const shown = quietLabel({
      status: "REVEALED",
      viewerIsA: true,
      aliasA: "Cedar",
      aliasB: "Maple",
      nameA: "Ada",
      nameB: "Ama",
    });
    expect(hidden).toBe("Maple");
    expect(shown).toBe("Ama");
  });

  it("starts the conversation only after both adults accept", () => {
    const first = applyQuietAccept("INTRODUCTION_CREATED", true, false, false);
    expect(first).toEqual({ status: "INTRODUCTION_CREATED", acceptedA: true, acceptedB: false });
    const second = applyQuietAccept("INTRODUCTION_CREATED", false, true, false);
    expect(second?.status).toBe("ACTIVE");
    expect(applyQuietAccept("ACTIVE", true, true, true)).toBeNull();
  });
});
