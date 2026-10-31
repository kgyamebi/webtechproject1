import { describe, expect, it } from "vitest";
import {
  ADULT_AGE,
  MINIMUM_REGISTRATION_AGE,
  ageInYears,
  assessAge,
  quietConnectAllowed,
  resolveDiscoverability,
  socialInteractionAllowed,
} from "@/server/identity/policy";

const today = new Date("2026-10-29T12:00:00.000Z");

describe("age policy", () => {
  it("rejects learners under the minimum age", () => {
    const decision = assessAge(new Date("2012-01-01T00:00:00.000Z"), today);
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.reason).toContain(String(MINIMUM_REGISTRATION_AGE));
    }
  });

  it("treats a 16th birthday on the current UTC date as eligible and still a minor", () => {
    const decision = assessAge(new Date("2010-10-29T00:00:00.000Z"), today);
    expect(decision).toEqual({ ok: true, age: 16, band: "minor" });
  });

  it("does not count the birthday until the UTC date arrives", () => {
    expect(ageInYears(new Date("2008-10-30T00:00:00.000Z"), today)).toBe(17);
  });

  it("marks an 18th birthday as adult", () => {
    const decision = assessAge(new Date("2008-10-29T00:00:00.000Z"), today);
    expect(decision).toEqual({ ok: true, age: ADULT_AGE, band: "adult" });
  });

  it("rejects a future date of birth", () => {
    const decision = assessAge(new Date("2027-01-01T00:00:00.000Z"), today);
    expect(decision.ok).toBe(false);
  });

  it("keeps minors out of discovery and Quiet Connect", () => {
    expect(resolveDiscoverability(true, "minor")).toBe(false);
    expect(resolveDiscoverability(false, "adult")).toBe(false);
    expect(resolveDiscoverability(true, "adult")).toBe(true);
    expect(quietConnectAllowed("minor")).toBe(false);
    expect(quietConnectAllowed("adult")).toBe(true);
  });

  it("blocks social contact between a minor and an adult", () => {
    expect(socialInteractionAllowed("minor", "adult")).toBe(false);
    expect(socialInteractionAllowed("adult", "minor")).toBe(false);
    expect(socialInteractionAllowed("minor", "minor")).toBe(true);
    expect(socialInteractionAllowed("adult", "adult")).toBe(true);
  });
});
