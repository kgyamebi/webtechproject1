"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { forgotPasswordAction, resetPasswordAction } from "@/server/identity/actions";
import { initialFormState } from "@/server/identity/schemas";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.formError ? <Alert tone="danger">{state.formError}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field label="Email" name="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.formError ? <Alert tone="danger">{state.formError}</Alert> : null}
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" error={state.fieldErrors?.password} hint="At least 10 characters, with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" disabled={pending || !token} aria-busy={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
      {!token ? <Alert tone="danger">This page needs the token from your reset email.</Alert> : null}
    </form>
  );
}
