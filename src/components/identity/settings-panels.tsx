"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { TabList, TabPanel } from "@/components/ui/tabs";
import {
  deleteAccountAction,
  updateNotificationsAction,
  updatePrivacyAction,
} from "@/server/identity/actions";
import { initialFormState } from "@/server/identity/schemas";

type PreferenceValues = {
  discoverable: boolean;
  showEmail: boolean;
  notifyFriendRequests: boolean;
  notifyMessages: boolean;
  notifyAcademic: boolean;
  notifyCommunities: boolean;
  minor: boolean;
};

export function SettingsPanels({ values }: { values: PreferenceValues }) {
  return (
    <TabList
      label="Account settings"
      tabs={[
        { value: "privacy", label: "Privacy" },
        { value: "notifications", label: "Notifications" },
        { value: "account", label: "Account" },
      ]}
    >
      <TabPanel value="privacy">
        <PrivacyForm values={values} />
      </TabPanel>
      <TabPanel value="notifications">
        <NotificationForm values={values} />
      </TabPanel>
      <TabPanel value="account">
        <AccountPanel />
      </TabPanel>
    </TabList>
  );
}

function PrivacyForm({ values }: { values: PreferenceValues }) {
  const [state, action, pending] = useActionState(updatePrivacyAction, initialFormState);

  return (
    <form action={action} className="grid gap-4">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.formError ? <Alert tone="danger">{state.formError}</Alert> : null}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="discoverable" defaultChecked={values.discoverable} disabled={values.minor} className="mt-1" />
        <span>
          Allow eligible students to discover this profile.
          {values.minor ? " This stays off for under-18 accounts." : ""}
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="showEmail" defaultChecked={values.showEmail} className="mt-1" />
        <span>Show my email address on my profile. This stays off unless you choose it.</span>
      </label>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save privacy"}
      </Button>
    </form>
  );
}

function NotificationForm({ values }: { values: PreferenceValues }) {
  const [state, action, pending] = useActionState(updateNotificationsAction, initialFormState);
  const choices = [
    ["notifyFriendRequests", "Friend requests", values.notifyFriendRequests],
    ["notifyMessages", "Messages", values.notifyMessages],
    ["notifyAcademic", "Academic updates", values.notifyAcademic],
    ["notifyCommunities", "Communities", values.notifyCommunities],
  ] as const;

  return (
    <form action={action} className="grid gap-4">
      <p className="text-sm leading-6 text-ink-soft">
        These choices decide which notices Campus+ stores. Academic notes, discussion replies, and office-hour claims are also copied to email when mail can be sent. Push and SMS are not sent.
      </p>
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {choices.map(([name, label, checked]) => (
        <label key={name} className="flex items-center gap-3 text-sm">
          <input type="checkbox" name={name} defaultChecked={checked} />
          {label}
        </label>
      ))}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save notifications"}
      </Button>
    </form>
  );
}

function AccountPanel() {
  const [state, action, pending] = useActionState(deleteAccountAction, initialFormState);

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="font-display text-2xl">Download your data</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          The file contains your profile and institution affiliation. It does not contain your password or session tokens.
        </p>
        <a href="/api/account/export" className="mt-4 inline-flex h-11 items-center rounded-full border border-line bg-paper px-4 text-sm font-medium">
          Download JSON
        </a>
      </div>
      <div>
        <h2 className="font-display text-2xl">Delete account</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Deletion removes the account, profile, and affiliation. This cannot be undone.
        </p>
        <div className="mt-4">
          <ConfirmDialog
            trigger={<Button variant="danger">Delete account</Button>}
            title="Delete this account?"
            description="Enter your password and type the confirmation phrase. The account is removed immediately."
          >
            <form action={action} className="grid gap-4">
              {state.formError ? <Alert tone="danger">{state.formError}</Alert> : null}
              <Field label="Password" name="password" error={state.fieldErrors?.password}>
                <Input id="password" name="password" type="password" autoComplete="current-password" />
              </Field>
              <Field label='Type "delete my account"' name="confirmation" error={state.fieldErrors?.confirmation}>
                <Input id="confirmation" name="confirmation" autoComplete="off" />
              </Field>
              <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
            </form>
          </ConfirmDialog>
        </div>
      </div>
    </div>
  );
}
