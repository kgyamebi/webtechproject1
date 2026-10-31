import { describe, expect, it } from "vitest";
import {
  affiliationFromVerifiedEmail,
  emailDomain,
  institutionAllowsRegistration,
  nextAffiliationStatus,
} from "@/server/identity/policy";

describe("institution affiliation", () => {
  it("reads a normalised domain", () => {
    expect(emailDomain(" Ada@Riverside.EDU ")).toBe("riverside.edu");
    expect(emailDomain("not-an-email")).toBeNull();
  });

  it("matches a verified university domain without calling it full verification", () => {
    expect(affiliationFromVerifiedEmail("ada@riverside.edu", ["riverside.edu"])).toBe(
      "DOMAIN_MATCHED",
    );
    expect(affiliationFromVerifiedEmail("ada@gmail.com", ["riverside.edu"])).toBe("PENDING");
  });

  it("does not downgrade a verified or rejected affiliation", () => {
    expect(nextAffiliationStatus("VERIFIED", "ada@gmail.com", ["riverside.edu"])).toBe("VERIFIED");
    expect(nextAffiliationStatus("REJECTED", "ada@riverside.edu", ["riverside.edu"])).toBe(
      "REJECTED",
    );
    expect(nextAffiliationStatus("PENDING", "ada@riverside.edu", ["Riverside.EDU"])).toBe(
      "DOMAIN_MATCHED",
    );
  });

  it("keeps junior high closed for this release", () => {
    expect(institutionAllowsRegistration("JUNIOR_HIGH")).toBe(false);
    expect(institutionAllowsRegistration("UNIVERSITY")).toBe(true);
    expect(institutionAllowsRegistration("SENIOR_HIGH")).toBe(true);
  });
});
