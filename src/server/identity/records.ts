import "server-only";

import { prisma } from "@/server/db/client";
import {
  ageBandFromBirth,
  institutionAllowsRegistration,
  nextAffiliationStatus,
  resolveDiscoverability,
  type InstitutionKind,
} from "@/server/identity/policy";

export async function listOpenInstitutions() {
  const institutions = await prisma.institution.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      emailDomains: true,
    },
  });

  return institutions.filter((institution) =>
    institutionAllowsRegistration(institution.kind),
  );
}

export async function getOrCreateProfile(userId: string, dateOfBirth: Date) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  const band = ageBandFromBirth(dateOfBirth);

  return prisma.profile.create({
    data: {
      userId,
      discoverable: resolveDiscoverability(true, band ?? "minor"),
    },
  });
}

export async function getPrimaryMembership(userId: string) {
  return prisma.institutionMembership.findFirst({
    where: { userId, isPrimary: true },
    include: {
      institution: {
        select: { id: true, name: true, kind: true, emailDomains: true },
      },
    },
  });
}

export async function syncAffiliationAfterVerification(userId: string, email: string) {
  const memberships = await prisma.institutionMembership.findMany({
    where: { userId },
    include: { institution: { select: { emailDomains: true } } },
  });

  for (const membership of memberships) {
    const status = nextAffiliationStatus(
      membership.status,
      email,
      membership.institution.emailDomains,
    );

    if (status !== membership.status) {
      await prisma.institutionMembership.update({
        where: { id: membership.id },
        data: { status },
      });
    }
  }
}

export function affiliationExplanation(status: string): string {
  switch (status) {
    case "DOMAIN_MATCHED":
      return "Your verified email domain matches this institution. That does not enrol you in courses or open an external learning system.";
    case "VERIFIED":
      return "An institution administrator has verified this affiliation. Course access still depends on an enrolment record.";
    case "REJECTED":
      return "This affiliation was not accepted. You can choose another institution from your profile.";
    default:
      return "This affiliation is pending. A matching university email becomes a domain match only after you verify the address.";
  }
}

export type OpenInstitution = {
  id: string;
  name: string;
  kind: InstitutionKind;
  emailDomains: string[];
};
