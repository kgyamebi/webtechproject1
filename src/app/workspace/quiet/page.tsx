import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { requireUser } from "@/server/auth/current";
import { listQuietHome, matchQuietAction, setQuietOptInAction } from "@/server/social/actions";
import Link from "next/link";

export const metadata = { title: "Quiet Connect" };

export default async function QuietPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const viewer = await requireUser();
  if (viewer.band !== "adult") {
    redirect("/workspace");
  }
  const notice = (await searchParams).notice;
  const home = await listQuietHome();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Quiet Connect</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Adults can opt in to an introduction that uses an alias. Both people accept before chat starts. A real name appears
          only after the other person agrees. A reveal does not create a friendship.
        </p>
      </div>
      {notice === "opt-in" ? <p className="rounded-2xl bg-coral/15 px-4 py-3 text-sm">Turn opt-in on and save before looking for an introduction.</p> : null}
      {notice === "waiting" ? (
        <p className="rounded-2xl bg-canvas px-4 py-3 text-sm">No other opted-in adult is free right now. Your opt-in stays on, so the next search can find you.</p>
      ) : null}
      <Card>
        <CardTitle>Opt in</CardTitle>
        <form action={setQuietOptInAction} className="mt-4 grid gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="optedIn" defaultChecked={home.optedIn} />
            I want to be introduced to another adult
          </label>
          <Field label="Conversation starters" name="starters">
            <Textarea id="starters" name="starters" defaultValue={home.starters} maxLength={240} />
          </Field>
          <Button type="submit">Save</Button>
        </form>
        <form action={matchQuietAction} className="mt-4">
          <Button type="submit" variant="secondary">
            Find an introduction
          </Button>
        </form>
        {!home.optedIn ? <CardText>Turn opt-in on before looking for a match.</CardText> : null}
      </Card>
      <section className="grid gap-3">
        {home.introductions.length === 0 ? (
          <EmptyState title="No introduction yet" body="Opt in, save, then find an introduction. Both people accept before a name can be revealed." />
        ) : null}
        {home.introductions.map((intro) => (
          <Card key={intro.id}>
            <CardTitle>{intro.label}</CardTitle>
            <CardText>{quietStatus(intro.status)}</CardText>
            <Link className="mt-3 inline-block text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/quiet/${intro.id}`}>
              Open
            </Link>
          </Card>
        ))}
      </section>
    </div>
  );
}

function quietStatus(status: string) {
  switch (status) {
    case "WAITING":
      return "Waiting for both people to accept before chat starts.";
    case "INTRODUCTION_CREATED":
      return "An introduction is ready. Accept it before a message can be sent.";
    case "ACTIVE":
      return "Both accepted. Names stay hidden until you both agree.";
    case "REVEAL_REQUESTED":
      return "A real name was requested. It appears only after the other person agrees.";
    case "REVEALED":
      return "Real names are visible. This did not create a friendship.";
    case "ENDED":
      return "This introduction is closed.";
    case "REPORTED":
      return "This introduction was reported.";
    default:
      return "This introduction is open.";
  }
}
