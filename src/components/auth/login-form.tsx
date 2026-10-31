"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginAction } from "@/server/identity/actions";
import { initialFormState } from "@/server/identity/schemas";

export function LoginForm({ nextPath, notice }: { nextPath?: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      {notice === "verified" ? <Alert tone="success">Email verified. You can sign in.</Alert> : null}
      {notice === "password-reset" ? <Alert tone="success">Password updated. Sign in with the new password.</Alert> : null}
      {state.formError ? <Alert tone="danger">{state.formError}</Alert> : null}
      <input type="hidden" name="next" value={nextPath ?? ""} />
      <Field label="Email" name="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.fieldErrors?.email)} />
      </Field>
      <Field label="Password" name="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(state.fieldErrors?.password)} />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <Link href="/forgot-password" className="text-sm text-pine underline-offset-4 hover:underline">
          Forgot password
        </Link>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
