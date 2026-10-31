import Link from "next/link";
import { Suspense } from "react";
import { PublicFrame } from "@/components/shell/public-frame";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { featureRegister, statusLabel } from "@/lib/feature-register";

const pillars = [
  { name: "Learn", text: "Courses, assignments, quizzes, and grades stay in one place, with the due date on the work itself." },
  { name: "Connect", text: "Message friends, or meet another adult through Random Connect. Under-18 accounts do not enter that queue." },
  { name: "Collaborate", text: "Communities and friends are separate from course enrolment. Joining a class does not publish your profile." },
  { name: "Discover", text: "Campus events and opportunities show the details that were actually saved, including whether a listing is official." },
  { name: "Grow", text: "Profile, privacy, and notification settings stay available after you sign in. Optional details can wait." },
];

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const ready = featureRegister.filter((feature) => feature.href);
  const later = featureRegister.filter((feature) => !feature.href);

  return (
    <PublicFrame>
      <Suspense>
        <DeletedNotice searchParams={searchParams} />
      </Suspense>
      <section className="grid items-center gap-10 py-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="campus-rise">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-brass">Campus+</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
            Learn together. Your campus, your people, your future.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
            Learn together, meet your people, manage your academic life, and discover opportunities—all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register">Create account</ButtonLink>
            <ButtonLink href="/#today" variant="secondary">
              Explore Campus+
            </ButtonLink>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink-soft">
            For students and the staff who teach them. Sign in to use your own courses and messages. The panel beside this text is a demonstration, not a live account.
          </p>
        </div>
        <div className="campus-rise-late grid gap-3" aria-label="Demonstration, not a signed-in account">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">Demonstration</p>
          <Card>
            <p className="text-xs uppercase tracking-wide text-brass">Learn</p>
            <CardTitle>Web Technologies</CardTitle>
            <CardText>Sample assignment: Build a personal page. Due date appears on the real course after you enrol.</CardText>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-brass">Connect</p>
            <CardTitle>A conversation</CardTitle>
            <CardText>Sample line: “See you at the project fair.” Real messages appear only for people you are allowed to contact.</CardText>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-brass">Campus life</p>
            <CardTitle>An event card</CardTitle>
            <CardText>Sample event. Saved events in the product come from the database, not from this preview.</CardText>
          </Card>
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-5">
        {pillars.map((pillar) => (
          <article key={pillar.name} className="rounded-3xl border border-line bg-paper p-4">
            <h2 className="font-display text-2xl">{pillar.name}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{pillar.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-14 grid gap-4 rounded-3xl border border-line bg-paper p-6 md:grid-cols-3">
        <div>
          <h2 className="font-display text-2xl">Who it is for</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Students from age 16, and the lecturers who run their courses. Accounts under 18 stay out of adult social matching.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl">What others can see</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">A profile is visible only when your privacy settings and the other person’s age rules allow it. Random Connect uses an alias until both people choose to be friends.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl">Safety</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Report, block, and privacy controls live in Settings and inside Connect. The simulated LMS card is a sample import, not a live Canvas connection.</p>
        </div>
      </section>

      <section id="today" className="mt-14">
        <h2 className="font-display text-3xl">What you can do now</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Each card names the current status. Simulated means a labelled sample, not a live external system.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {ready.map((feature) => (
            <Card key={feature.id}>
              <p className="text-xs uppercase tracking-wide text-brass">{statusLabel[feature.status]}</p>
              <CardTitle>{feature.name}</CardTitle>
              <CardText>{feature.summary}</CardText>
              {feature.href ? (
                <Link href={feature.href} className="mt-4 inline-block text-sm text-pine underline-offset-4 hover:underline">
                  Open
                </Link>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      {later.length > 0 ? (
        <section id="roadmap" className="mt-12">
          <h2 className="font-display text-3xl">Not built yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            These areas are part of the product plan. They are listed so the map stays honest. None of them can be opened from here.
          </p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {later.map((feature) => (
              <li key={feature.id} className="rounded-2xl border border-line bg-paper/70 px-4 py-3">
                <p className="font-medium">{feature.name}</p>
                <p className="text-sm text-ink-soft">{feature.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PublicFrame>
  );
}

async function DeletedNotice({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  if (params.notice !== "account-deleted") {
    return null;
  }

  return (
    <div className="mb-6">
      <Alert tone="success">Your account has been deleted from Campus+.</Alert>
    </div>
  );
}
