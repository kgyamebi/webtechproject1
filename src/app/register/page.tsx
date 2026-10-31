import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { PublicFrame } from "@/components/shell/public-frame";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { FormSkeleton } from "@/components/ui/skeleton";
import { listOpenInstitutions } from "@/server/identity/records";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <PublicFrame title="Create your account">
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-brass">Step 1 · Account</p>
      <p className="mt-3 max-w-xl text-ink-soft">
        Use a password you do not reuse. Your date of birth stays private and decides whether
        adult-only social tools can be offered later.
      </p>
      <Card className="mt-8 max-w-xl">
        <Suspense fallback={<FormSkeleton />}>
          <RegisterSection />
        </Suspense>
      </Card>
    </PublicFrame>
  );
}

async function RegisterSection() {
  let institutions: Awaited<ReturnType<typeof listOpenInstitutions>> = [];
  let unavailable = false;

  try {
    institutions = await listOpenInstitutions();
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    return (
      <ErrorState
        title="Institutions could not be loaded"
        body="The database is not reachable. Start PostgreSQL, confirm DATABASE_URL, and reload this page."
      />
    );
  }

  return <RegisterForm institutions={institutions} />;
}
