import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AvatarForm, ProfileForm } from "@/components/identity/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { updateInterestsAction } from "@/server/social/actions";
import { getOrCreateProfile, getPrimaryMembership, listOpenInstitutions } from "@/server/identity/records";
import { ageBandFromBirth } from "@/server/identity/policy";
import { helpedCourses } from "@/server/campus-loop/actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login?next=/workspace/profile");
  }

  const dateOfBirth = new Date(session.user.dateOfBirth);
  const band = ageBandFromBirth(dateOfBirth);
  const [profile, membership, institutions] = await Promise.all([
    getOrCreateProfile(session.user.id, dateOfBirth),
    getPrimaryMembership(session.user.id),
    listOpenInstitutions(),
  ]);
  const helped = await helpedCourses(session.user.id);

  return (
    <div className="grid gap-6">
      <div>
        <p className="kicker">Profile</p>
        <h1 className="stage-title mt-3">{session.user.name}</h1>
        <p className="mt-4 text-sm text-ink-soft">
          {[profile.programme, membership?.institution.name].filter(Boolean).join(" · ") || "Programme and institution can be added below."}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          {band === "adult"
            ? "Adult account. People under 18 are not shown to you, and you are not shown to them."
            : "Under-18 account. Adults are not shown here, and Quiet Connect and Random Connect stay closed."}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          Photo, programme, and matching tags live here. Privacy, data download, and account deletion are in{" "}
          <Link href="/workspace/settings" className="text-pine underline-offset-4 hover:underline">
            Settings
          </Link>
          .
        </p>
        {helped.length > 0 ? <p className="mt-3 text-sm text-ink-soft">Helped on {helped.join(", ")}.</p> : null}
      </div>
      <Card>
        <CardTitle>Photo</CardTitle>
        <div className="mt-4">
          <AvatarForm
            userId={session.user.id}
            hasImage={Boolean(profile.avatarPath)}
            imageVersion={profile.updatedAt.toISOString()}
          />
        </div>
      </Card>
      <Card>
        <CardTitle>Details</CardTitle>
        <div className="mt-4">
          <ProfileForm
            name={session.user.name}
            biography={profile.biography}
            programme={profile.programme}
            department={profile.department}
            institutionId={membership?.institutionId ?? ""}
            institutions={institutions}
            affiliationLocked={membership?.status === "VERIFIED"}
          />
        </div>
      </Card>
      <Card>
        <CardTitle>Ready for People</CardTitle>
        <ul className="mt-3 grid gap-2 text-sm">
          <li>{profile.avatarPath ? "Photo added." : "No photo yet. The card above can add one."}</li>
          <li>{profile.programme ? `Programme: ${profile.programme}.` : "Programme is blank. It shows on a recommendation when you fill it in."}</li>
          <li>
            {profile.interests.length > 0 || profile.subjects.length > 0
              ? "Matching tags are set. People can explain a shared tag."
              : "No interests or subjects yet. Recommendations stay empty until a tag is shared."}
          </li>
          <li>
            {profile.discoverable
              ? "This profile can be discovered by people in the same age band."
              : "Discovery is off. Under-18 accounts stay off. Adults can turn it on in Settings."}
          </li>
        </ul>
        <Link href="/workspace/settings" className="mt-4 inline-block text-sm text-pine underline-offset-4 hover:underline">
          Privacy settings
        </Link>
      </Card>
      <Card id="tags">
        <CardTitle>Matching tags</CardTitle>
        <form action={updateInterestsAction} className="mt-4 grid gap-3">
          <Field label="Interests" name="interests" hint="Comma-separated. These explain People recommendations.">
            <Input id="interests" name="interests" defaultValue={profile.interests.join(", ")} />
          </Field>
          <Field label="Skills" name="skills">
            <Input id="skills" name="skills" defaultValue={profile.skills.join(", ")} />
          </Field>
          <Field label="Subjects" name="subjects">
            <Input id="subjects" name="subjects" defaultValue={profile.subjects.join(", ")} />
          </Field>
          <Field label="Project goals" name="projectGoals">
            <Input id="projectGoals" name="projectGoals" defaultValue={profile.projectGoals.join(", ")} />
          </Field>
          <Field label="Career interests" name="careerInterests">
            <Input id="careerInterests" name="careerInterests" defaultValue={profile.careerInterests.join(", ")} />
          </Field>
          <Field label="Study preference" name="studyPreference">
            <Input id="studyPreference" name="studyPreference" defaultValue={profile.studyPreference} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowFriendRequests" defaultChecked={profile.allowFriendRequests} />
            Allow friend requests
          </label>
          <Button type="submit">Save tags</Button>
        </form>
      </Card>
    </div>
  );
}
