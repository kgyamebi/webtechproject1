import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { PublicFrame } from "@/components/shell/public-frame";
import { Card } from "@/components/ui/card";
import { FormSkeleton } from "@/components/ui/skeleton";
import { safeWorkspacePath } from "@/server/http/redirects";

export const metadata = { title: "Sign in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; next?: string }>;
}) {
  return (
    <PublicFrame title="Sign in">
      <p className="mt-3 max-w-xl text-ink-soft">
        Email verification is required. A university address does not by itself open courses.
      </p>
      <Card className="mt-8 max-w-xl">
        <Suspense fallback={<FormSkeleton />}>
          <LoginSection searchParams={searchParams} />
        </Suspense>
      </Card>
      <p className="mt-4 text-sm text-ink-soft">
        New here? <Link className="text-pine underline-offset-4 hover:underline" href="/register">Create an account</Link>
      </p>
    </PublicFrame>
  );
}

async function LoginSection({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; next?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm notice={params.notice} nextPath={safeWorkspacePath(params.next)} />;
}
