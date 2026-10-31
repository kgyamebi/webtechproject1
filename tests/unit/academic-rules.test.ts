import { describe, expect, it } from "vitest";
import {
  attemptExpired,
  canReadGrade,
  canReadSubmission,
  canStartAttempt,
  categoryPercent,
  objectiveMax,
  safeHttpUrl,
  scoreQuestion,
  simulatedImportShouldBeRemoved,
  submissionAccepted,
  viewerCanSeeContent,
  weightedTotal,
} from "@/server/academic/rules";

describe("quiz scoring", () => {
  const single = {
    id: "q1",
    type: "SINGLE" as const,
    points: 2,
    correctOptionIds: ["a"],
  };

  it("scores objective questions on the server and leaves essays unmarked", () => {
    expect(scoreQuestion(single, { questionId: "q1", selectedOptionIds: ["a"] }).awarded).toBe(2);
    expect(scoreQuestion(single, { questionId: "q1", selectedOptionIds: ["b"] }).awarded).toBe(0);
    expect(
      scoreQuestion(
        { id: "q2", type: "MULTIPLE", points: 3, correctOptionIds: ["a", "c"] },
        { questionId: "q2", selectedOptionIds: ["c", "a"] },
      ).awarded,
    ).toBe(3);
    expect(
      scoreQuestion(
        { id: "q3", type: "SHORT", points: 1, correctOptionIds: [], correctText: "Accra" },
        { questionId: "q3", selectedOptionIds: [], textAnswer: "  accra " },
      ).awarded,
    ).toBe(1);
    expect(
      scoreQuestion(
        { id: "q4", type: "NUMERICAL", points: 1, correctOptionIds: [], numericalAnswer: 9.8, numericalTolerance: 0.05 },
        { questionId: "q4", selectedOptionIds: [], textAnswer: "9.82" },
      ).awarded,
    ).toBe(1);
    expect(scoreQuestion({ id: "q5", type: "ESSAY", points: 10, correctOptionIds: [] }, undefined).manual).toBe(true);
    expect(objectiveMax([single, { id: "q5", type: "ESSAY", points: 10, correctOptionIds: [] }])).toBe(2);
  });

  it("enforces open windows, attempt limits, and the timer", () => {
    const now = new Date("2026-10-29T12:00:00.000Z");
    expect(
      canStartAttempt({
        published: true,
        now,
        openAt: null,
        closeAt: null,
        attemptCount: 1,
        attemptLimit: 1,
        hasOpenAttempt: false,
      }).ok,
    ).toBe(false);
    expect(attemptExpired(new Date("2026-10-29T11:00:00.000Z"), now, 30, null)).toBe(true);
    expect(submissionAccepted(now, new Date("2026-10-29T11:00:00.000Z"), false).ok).toBe(false);
    expect(submissionAccepted(now, new Date("2026-10-29T11:00:00.000Z"), true)).toEqual({ ok: true, late: true });
  });
});

describe("grades and visibility", () => {
  it("hides unreleased grades from the student who owns them", () => {
    expect(canReadGrade({ isStaff: false, isOwner: true, released: false })).toBe(false);
    expect(canReadGrade({ isStaff: true, isOwner: false, released: false })).toBe(true);
    expect(canReadSubmission({ isStaff: false, isOwner: false })).toBe(false);
  });

  it("scales category weights when one category has no released work", () => {
    expect(categoryPercent([{ points: 8, maxPoints: 10 }])).toBe(80);
    expect(
      weightedTotal([
        { weight: 50, percent: 80 },
        { weight: 50, percent: null },
      ]),
    ).toBe(80);
  });

  it("keeps private posts and expired stories closed", () => {
    expect(
      viewerCanSeeContent({
        isAuthor: false,
        blocked: false,
        audience: "CONNECTIONS",
        isFriend: false,
        inCommunity: false,
        inCourse: false,
        sameInstitution: true,
      }),
    ).toBe(false);
    expect(
      viewerCanSeeContent({
        isAuthor: false,
        blocked: false,
        audience: "CONNECTIONS",
        isFriend: true,
        inCommunity: false,
        inCourse: false,
        sameInstitution: false,
        expired: true,
      }),
    ).toBe(false);
  });

  it("accepts only http links and removes simulated imports on disconnect", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("https://example.edu/apply")).toContain("https://");
    expect(simulatedImportShouldBeRemoved("SIMULATED")).toBe(true);
    expect(simulatedImportShouldBeRemoved("NATIVE")).toBe(false);
  });
});
