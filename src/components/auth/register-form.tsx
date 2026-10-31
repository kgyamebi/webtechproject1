"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { registerAction } from "@/server/identity/actions";
import { initialFormState } from "@/server/identity/schemas";

export function RegisterForm({
  institutions,
}: {
  institutions: Array<{ id: string; name: string; emailDomains: string[] }>;
}) {
  const [state, action, pending] = useActionState(registerAction, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.formError ? <Alert tone="danger">{state.formError}</Alert> : null}
      <Field label="Name" name="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="name" required aria-invalid={Boolean(state.fieldErrors?.name)} />
      </Field>
      <Field label="Email" name="email" error={state.fieldErrors?.email} hint="A university address can match an institution after you verify it.">
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.fieldErrors?.email)} />
      </Field>
      <Field label="Password" name="password" error={state.fieldErrors?.password} hint="At least 10 characters, with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} aria-invalid={Boolean(state.fieldErrors?.password)} />
      </Field>
      <Field label="Date of birth" name="dateOfBirth" error={state.fieldErrors?.dateOfBirth} hint="Used for age rules. It is not shown on your public profile.">
        <Input id="dateOfBirth" name="dateOfBirth" type="date" required aria-invalid={Boolean(state.fieldErrors?.dateOfBirth)} />
      </Field>
      <Field label="Institution" name="institutionId" error={state.fieldErrors?.institutionId} hint="Optional. Choosing one does not enrol you in a course.">
        <Select id="institutionId" name="institutionId" defaultValue="">
          <option value="">I will add this later</option>
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
              {institution.emailDomains.length > 0 ? ` (${institution.emailDomains.join(", ")})` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
