import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { loadConnectHome, saveConnectPreferencesAction } from "@/server/connect/actions";

export const metadata = { title: "Safety and privacy" };

export default async function ConnectSafetyPage() {
  const home = await loadConnectHome();
  if (!home.adult) {
    return (
      <Card>
        <CardTitle>Random Connect is closed</CardTitle>
        <CardText>Under-18 accounts are not placed in this queue.</CardText>
      </Card>
    );
  }

  return (
    <div className="grid h-full content-start gap-6 overflow-y-auto p-4">
      <div>
        <h1 className="font-display text-4xl">Safety and privacy</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          A match shows an alias and up to three shared tags. It does not show your legal name, email, or institution
          unless you later accept a friend request and your profile settings allow it. Campus+ does not record calls.
          A voice or video call can start in an open conversation only while the media server is running. If that
          process is stopped, the conversation stays text.
        </p>
      </div>
      <Card>
        <CardTitle>Pause matching</CardTitle>
        <CardText>Turning availability off removes you from new matches. An open conversation stays open until someone ends it.</CardText>
        <form action={saveConnectPreferencesAction} className="mt-4">
          <input type="hidden" name="language" value={home.preference?.language ?? ""} />
          <input type="hidden" name="mode" value={home.preference?.mode ?? "SURPRISE"} />
          <input type="hidden" name="studyIntent" value={home.preference?.studyIntent ?? ""} />
          <Button type="submit" variant="secondary">
            Turn availability off
          </Button>
        </form>
      </Card>
      <Card>
        <CardTitle>During a chat</CardTitle>
        <CardText>
          You can end the conversation, block the other person, or report the session. A block stops future matches and
          new friend requests. A report opens a case for a platform administrator. The other person is not told who
          reported them.
        </CardText>
      </Card>
      <p className="text-sm text-ink-soft">A call is limited to four people. Nothing is stored, and a call is not simulated when the media server is stopped.</p>
      <Link className="text-sm text-pine underline-offset-4 hover:underline" href="/workspace/settings">
        Profile privacy and notification settings
      </Link>
    </div>
  );
}
