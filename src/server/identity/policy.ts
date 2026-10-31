/**
 * Identity rules that do not talk to the database.
 *
 * These functions are the source of truth for age, institution affiliation,
 * and who may use social features. Server actions call them before any write.
 * Unit tests cover them without PostgreSQL so the rules stay easy to explain.
 */

export const MINIMUM_REGISTRATION_AGE = 16;
export const ADULT_AGE = 18;

export const AFFILIATION_STATUSES = [
  "PENDING",
  "DOMAIN_MATCHED",
  "VERIFIED",
  "REJECTED",
] as const;

export type AffiliationStatus = (typeof AFFILIATION_STATUSES)[number];

export const INSTITUTION_KINDS = [
  "UNIVERSITY",
  "TECHNICAL_UNIVERSITY",
  "COLLEGE",
  "OTHER_TERTIARY",
  "SENIOR_HIGH",
  "JUNIOR_HIGH",
] as const;

export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];

export type AgeBand = "minor" | "adult";

export type AgeDecision =
  | { ok: true; age: number; band: AgeBand }
  | { ok: false; reason: string };

/**
 * Age is calculated from UTC calendar dates so a birthday does not flip
 * depending on the machine's local timezone.
 */
export function ageInYears(dateOfBirth: Date, today = new Date()): number {
  const year = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDelta = today.getUTCDate() - dateOfBirth.getUTCDate();
  const birthdayHasPassed = monthDelta > 0 || (monthDelta === 0 && dayDelta >= 0);
  return birthdayHasPassed ? year : year - 1;
}

export function assessAge(dateOfBirth: Date, today = new Date()): AgeDecision {
  if (Number.isNaN(dateOfBirth.getTime())) {
    return { ok: false, reason: "Enter a valid date of birth." };
  }

  if (dateOfBirth.getTime() > today.getTime()) {
    return { ok: false, reason: "Date of birth cannot be in the future." };
  }

  const age = ageInYears(dateOfBirth, today);

  if (age < MINIMUM_REGISTRATION_AGE) {
    return {
      ok: false,
      reason: `Campus+ currently accepts learners who are at least ${MINIMUM_REGISTRATION_AGE}.`,
    };
  }

  return {
    ok: true,
    age,
    band: age >= ADULT_AGE ? "adult" : "minor",
  };
}

/**
 * HTML date inputs are calendar dates, not timestamps. Construct them in UTC
 * and reject values that roll over, such as 31 February.
 */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function ageBandFromBirth(dateOfBirth: Date, today = new Date()): AgeBand | null {
  const decision = assessAge(dateOfBirth, today);
  return decision.ok ? decision.band : null;
}

export function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return null;
  }

  const domain = trimmed.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return null;
  }

  return domain;
}

/**
 * A matching email domain is not institution verification and it does not
 * enrol the person in any course. Call this only after the address is verified,
 * otherwise someone could claim a university domain they do not control.
 */
export function affiliationFromVerifiedEmail(
  email: string,
  emailDomains: string[],
): "PENDING" | "DOMAIN_MATCHED" {
  const domain = emailDomain(email);
  if (!domain) {
    return "PENDING";
  }

  const accepted = new Set(emailDomains.map((item) => item.toLowerCase()));
  return accepted.has(domain) ? "DOMAIN_MATCHED" : "PENDING";
}

/**
 * Verification and rejection are deliberate decisions. A later email check
 * must not overwrite them. Pending is the only status a domain match can raise.
 */
export function nextAffiliationStatus(
  current: AffiliationStatus,
  email: string,
  emailDomains: string[],
): AffiliationStatus {
  if (current !== "PENDING") {
    return current;
  }

  return affiliationFromVerifiedEmail(email, emailDomains);
}

/**
 * Junior high is reserved in the schema so the model can grow, but this
 * release does not open accounts for that level.
 */
export function institutionAllowsRegistration(kind: InstitutionKind): boolean {
  return kind !== "JUNIOR_HIGH";
}

/**
 * Minors are not placed in discovery, even if the form asks for it.
 * Adults keep the choice they submitted.
 */
export function resolveDiscoverability(requested: boolean, band: AgeBand): boolean {
  if (band === "minor") {
    return false;
  }

  return requested;
}

/**
 * Social contact between minors and adults is refused. Academic tools will
 * use course enrolment instead of this social rule, so a lecturer can still
 * publish coursework for a class without opening a private social chat.
 */
export function socialInteractionAllowed(a: AgeBand, b: AgeBand): boolean {
  return a === b;
}

/** Quiet Connect is adult-only. Anonymous introductions are not offered to minors. */
export function quietConnectAllowed(band: AgeBand): boolean {
  return band === "adult";
}
