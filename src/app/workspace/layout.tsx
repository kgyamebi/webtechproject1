import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import { WelcomeTour } from "@/components/shell/welcome-tour";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { ageBandFromBirth } from "@/server/identity/policy";
import { getOrCreateProfile } from "@/server/identity/records";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkspaceGate>{children}</WorkspaceGate>
    </Suspense>
  );
}

async function WorkspaceGate({ children }: { children: React.ReactNode }) {
  let name = "";
  let band: "adult" | "minor" = "minor";
  let tourSeen = true;
  let unavailable = false;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      redirect("/login?next=/workspace");
    }

    const dateOfBirth = new Date(session.user.dateOfBirth);
    const profile = await getOrCreateProfile(session.user.id, dateOfBirth);
    name = session.user.name;
    band = ageBandFromBirth(dateOfBirth) ?? "minor";
    tourSeen = Boolean(profile.tourSeenAt);
  } catch (error) {
    unstable_rethrow(error);
    unavailable = true;
  }

  if (unavailable) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <ErrorState
          title="The workspace could not be loaded"
          body="PostgreSQL is not reachable. Start Docker, run npm run db:up, then npm run db:migrate, and reload."
        />
      </main>
    );
  }

  return (
    <AppShell name={name} band={band}>
      <WelcomeTour name={name} band={band} seen={tourSeen} />
      {children}
    </AppShell>
  );
}
