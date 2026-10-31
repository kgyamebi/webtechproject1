"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateProfileAction, uploadAvatarAction } from "@/server/identity/actions";
import { initialFormState } from "@/server/identity/schemas";
import { useEffect } from "react";

export function ProfileForm({
  name,
  biography,
  programme,
  department,
  institutionId,
  institutions,
  affiliationLocked,
}: {
  name: string;
  biography: string;
  programme: string;
  department: string;
  institutionId: string;
  institutions: Array<{ id: string; name: string }>;
  affiliationLocked: boolean;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initialFormState);
  const { push } = useToast();

  useEffect(() => {
    if (state.success) {
      push(state.success);
    }
  }, [state.success, push]);

  return (
    <form action={action} className="grid gap-4">
      {state.formError ? <Alert tone="danger">{state.formError}</Alert> : null}
      <Field label="Name" name="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={name} required />
      </Field>
      <Field label="Programme" name="programme" error={state.fieldErrors?.programme}>
        <Input id="programme" name="programme" defaultValue={programme} />
      </Field>
      <Field label="Department" name="department" error={state.fieldErrors?.department}>
        <Input id="department" name="department" defaultValue={department} />
      </Field>
      <Field label="Biography" name="biography" error={state.fieldErrors?.biography}>
        <Textarea id="biography" name="biography" defaultValue={biography} maxLength={500} />
      </Field>
      <Field
        label="Institution"
        name="institutionId"
        error={state.fieldErrors?.institutionId}
        hint={
          affiliationLocked
            ? "This affiliation is verified, so it cannot be changed here."
            : "A domain match still does not enrol you in a course."
        }
      >
        <Select id="institutionId" name="institutionId" defaultValue={institutionId} disabled={affiliationLocked}>
          <option value="">No institution yet</option>
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
            </option>
          ))}
        </Select>
      </Field>
      {affiliationLocked ? <input type="hidden" name="institutionId" value={institutionId} /> : null}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function AvatarForm({
  userId,
  hasImage,
  imageVersion,
}: {
  userId: string;
  hasImage: boolean;
  imageVersion: string;
}) {
  const [state, action, pending] = useActionState(uploadAvatarAction, initialFormState);

  return (
    <form action={action} className="grid gap-4">
      <div className="flex items-center gap-4">
        {hasImage ? (
          // User uploads are served by our own route after a byte check.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/avatar/${userId}?v=${imageVersion}`}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full bg-canvas text-sm text-ink-soft">
            None
          </div>
        )}
        <Field label="Profile image" name="avatar" error={state.fieldErrors?.avatar} hint="JPEG, PNG, or WebP. Maximum 2 MB.">
          <Input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
      </div>
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
        {pending ? "Uploading…" : "Upload image"}
      </Button>
    </form>
  );
}
