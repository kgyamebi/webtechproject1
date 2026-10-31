import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SettingsPanels } from "@/components/identity/settings-panels";
import { getOrCreateProfile } from "@/server/identity/records";
import { ageBandFromBirth } from "@/server/identity/policy";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login?next=/workspace/settings");
  }

  const dateOfBirth = new Date(session.user.dateOfBirth);
  const profile = await getOrCreateProfile(session.user.id, dateOfBirth);
  const band = ageBandFromBirth(dateOfBirth) ?? "minor";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Settings</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {band === "adult" ? "Adult account." : "Under-18 account. Quiet Connect and Random Connect stay closed."}{" "}
          {session.user.emailVerified ? "This email is verified." : "This email is not verified yet."} Email addresses stay hidden unless you opt in. {session.user.email}
        </p>
      </div>
      <SettingsPanels
        values={{
          discoverable: profile.discoverable,
          showEmail: profile.showEmail,
          notifyFriendRequests: profile.notifyFriendRequests,
          notifyMessages: profile.notifyMessages,
          notifyAcademic: profile.notifyAcademic,
          notifyCommunities: profile.notifyCommunities,
          minor: band === "minor",
        }}
      />
    </div>
  );
}
