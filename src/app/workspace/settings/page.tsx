import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SettingsPanels } from "@/components/identity/settings-panels";
import { Button } from "@/components/ui/button";
import { getOrCreateProfile } from "@/server/identity/records";
import { ageBandFromBirth } from "@/server/identity/policy";
import { formatMinute } from "@/lib/campus-loop";
import { updatePresenceAction } from "@/server/campus-loop/actions";

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
      <form action={updatePresenceAction} className="grid max-w-xl gap-4">
        <h2 className="font-display text-2xl">How you show up</h2>
        <p className="text-sm leading-6 text-ink-soft">
          Status is three words you set. Typing and read receipts stay off until you turn them on. Quiet hours sleep the feed. Friends and course alerts still arrive.
        </p>
        <label className="grid gap-1 text-sm">
          Status
          <select name="presence" defaultValue={profile.presence} className="h-11 rounded-xl border border-line bg-transparent px-3">
            <option value="AVAILABLE">Available</option>
            <option value="IN_CLASS">In class</option>
            <option value="FOCUSING">Focusing</option>
          </select>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="shareTyping" defaultChecked={profile.shareTyping} className="mt-1" />
          <span>Let people in my chats see when I am writing.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="shareReadReceipts" defaultChecked={profile.shareReadReceipts} className="mt-1" />
          <span>Let people see when I have read a message.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="shareDeadlineLine" defaultChecked={profile.shareDeadlineLine} className="mt-1" />
          <span>Let friends see one line when I have a quiz in the next day. The score stays private.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="quietHoursOn" defaultChecked={profile.quietHoursOn} className="mt-1" />
          <span>Sleep the feed between these times.</span>
        </label>
        <label className="grid gap-1 text-sm">
          Feed sleeps from
          <input name="quietStart" type="time" defaultValue={formatMinute(profile.quietStartMinute)} className="h-11 rounded-xl border border-line bg-transparent px-3" />
        </label>
        <label className="grid gap-1 text-sm">
          Feed wakes at
          <input name="quietEnd" type="time" defaultValue={formatMinute(profile.quietEndMinute)} className="h-11 rounded-xl border border-line bg-transparent px-3" />
        </label>
        <Button type="submit">Save how I show up</Button>
      </form>
    </div>
  );
}
