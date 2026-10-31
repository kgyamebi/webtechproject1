import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ageBandFromBirth, type AgeBand } from "@/server/identity/policy";

export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login?next=/workspace");
  }
  const band = ageBandFromBirth(new Date(session.user.dateOfBirth)) ?? "minor";
  return { session, userId: session.user.id, band: band as AgeBand, name: session.user.name, email: session.user.email };
}
