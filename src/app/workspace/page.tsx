import Link from "next/link";
import { ReplayTourButton } from "@/components/shell/welcome-tour";
import { workspaceHome } from "@/server/campus/actions";
import { deskLoop } from "@/server/campus-loop/actions";

export const metadata = { title: "Workspace" };

type DeskItem = {
  id: string;
  at: Date;
  href: string;
  title: string;
  detail: string;
  kind: string;
};

function until(date: Date, now: Date) {
  const hours = Math.round((date.getTime() - now.getTime()) / (60 * 60 * 1000));
  if (hours < 0) return "Overdue.";
  if (hours <= 1) return "Due within the hour.";
  if (hours < 48) return `Due in ${hours} hours.`;
  return `Due in ${Math.round(hours / 24)} days.`;
}

function daypart(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export default async function WorkspacePage() {
  const home = await workspaceHome();
  const loop = await deskLoop();
  const now = new Date();
  const desk: DeskItem[] = [
    ...home.deadlines.assignments.map((assignment) => ({
      id: assignment.id,
      at: assignment.dueAt,
      href: `/workspace/learn/${assignment.courseId}/assignments/${assignment.id}`,
      title: assignment.title,
      detail: assignment.course.title,
      kind: "Assignment",
    })),
    ...home.deadlines.quizzes.flatMap((quiz) =>
      quiz.closeAt
        ? [{
            id: quiz.id,
            at: quiz.closeAt,
            href: `/workspace/learn/${quiz.courseId}/quizzes/${quiz.id}`,
            title: quiz.title,
            detail: quiz.course.title,
            kind: "Quiz",
          }]
        : [],
    ),
    ...home.savedEvents.map((event) => ({
      id: event.id,
      at: event.startsAt,
      href: "/workspace/events",
      title: event.title,
      detail: "Saved on Campus Life",
      kind: "Campus",
    })),
  ].sort((left, right) => left.at.getTime() - right.at.getTime());
  const next = desk.find((item) => item.kind === "Assignment" || item.kind === "Quiz") ?? null;
  const first = home.name.split(" ")[0] || home.name;
  const today = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="pt-4 md:pt-8">
      <p className="kicker">{today}</p>
      <h1 className="greeting mt-4">
        <span className="block">{daypart(now)},</span>
        <span className="block">{first}.</span>
        <span className="sr-only">Hello, {home.name}</span>
      </h1>
      <p className="mt-6 max-w-xl text-sm leading-6 text-ink-soft">
        {home.courses} course{home.courses === 1 ? "" : "s"} on your desk
        {home.progress.published > 0
          ? ` · ${home.progress.submitted} of ${home.progress.published} published assignment${home.progress.published === 1 ? "" : "s"} submitted`
          : ""}
        {home.unread > 0 ? ` · ${home.unread} unread notification${home.unread === 1 ? "" : "s"}` : ""}
      </p>
      {loop.soonQuiz ? (
        <section className="mt-8 max-w-xl">
          <p className="kicker">This course steps forward</p>
          <h2 className="mt-3 font-display text-3xl">{loop.soonQuiz.courseTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {loop.soonQuiz.title} closes {loop.soonQuiz.closeAt.toLocaleString()}. The feed is stepped back until then.
          </p>
          <Link href={loop.soonQuiz.href} className="mt-4 inline-flex text-sm text-ink underline-offset-4 hover:underline">
            Open the quiz
          </Link>
        </section>
      ) : null}
      {loop.together.length > 0 ? (
        <ul className="mt-6 grid gap-2 text-sm text-ink-soft">
          {loop.together.map((session) => (
            <li key={`${session.name}-${session.assignmentTitle}`}>
              {session.name} is on {session.assignmentTitle}. Until {session.endsAt.toLocaleTimeString()}. No camera.
            </li>
          ))}
        </ul>
      ) : null}
      {loop.friendLines.length > 0 ? (
        <ul className="mt-4 grid gap-1 text-sm text-ink-soft">
          {loop.friendLines.map((line) => (
            <li key={`${line.name}-${line.quizTitle}`}>{line.name} has a quiz coming up · {line.quizTitle}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-sm">
        <Link href="/workspace/week" className="text-ink underline-offset-4 hover:underline">
          {loop.sunday ? "Your week is ready" : "Your week"}
        </Link>
      </p>
      <div className="mt-4">
        <ReplayTourButton />
      </div>

      <section className="mt-16 grid items-end gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.7fr)]">
        <div>
          <p className="kicker">Your next deadline</p>
          {next ? (
            <>
              <h2 className="mt-4 max-w-xl font-display text-4xl leading-[1.05] md:text-5xl">{next.title}</h2>
              <p className="mt-4 text-sm text-ink-soft">
                {next.kind} · {next.detail}
              </p>
              <p className="mt-1 text-sm text-ink">{next.at.toLocaleString()}</p>
              <p className="mt-1 text-sm text-ink-soft">{until(next.at, now)}</p>
              <Link href={next.href} className="mt-8 inline-flex h-11 items-center bg-ink px-5 text-sm font-medium text-[var(--canvas)]">
                Open it
              </Link>
            </>
          ) : (
            <>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] md:text-5xl">Nothing is due.</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-ink-soft">
                You have cleared the deadlines currently on your desk. Courses you join will put the next piece of work here.
              </p>
              <Link href="/workspace/learn" className="mt-8 inline-flex h-11 items-center bg-ink px-5 text-sm font-medium text-[var(--canvas)]">
                Go to Learn
              </Link>
            </>
          )}
        </div>
        <div className="grid gap-8 text-sm">
          {home.quiet ? (
            <p className="leading-6 text-ink-soft">
              Open introduction with {home.quiet.label}. A real name stays hidden until both people agree.{" "}
              <Link href={home.quiet.href} className="text-ink underline-offset-4 hover:underline">
                Open your introduction
              </Link>
            </p>
          ) : null}
          <p className="leading-6 text-ink-soft">
            {home.band === "adult" ? "Adult account." : "Under-18 account."}{" "}
            <Link href="/workspace/notifications" className="text-ink underline-offset-4 hover:underline">
              {home.unread} unread
            </Link>
            {" · "}
            <Link href="/workspace/messages" className="text-ink underline-offset-4 hover:underline">
              Messages · {home.unreadMessages} unread
            </Link>
            {home.band === "adult" ? (
              <>
                {" · "}
                <Link href="/workspace/connect" className="text-ink underline-offset-4 hover:underline">
                  Open Connect
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </section>

      <div className="mt-20 grid gap-16 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl">On the desk</h2>
          {desk.length === 0 ? (
            <p className="mt-6 text-sm leading-6 text-ink-soft">No upcoming deadlines. You have cleared everything currently scheduled.</p>
          ) : (
            <div className="mt-4">
              {desk.map((item) => {
                const soon = item.at.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
                return (
                <div key={`${item.kind}-${item.id}`} className="ruled-row">
                  <p className="text-xs leading-5 text-ink-soft">
                    <span className="block text-ink">{item.at.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    {item.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <p className="min-w-0 text-sm">
                    <Link href={item.href} className="font-medium text-ink underline-offset-4 hover:underline">
                      {item.title}
                    </Link>
                    <span className="mt-0.5 block text-ink-soft">
                      {item.kind} · {item.detail}{item.at.getTime() < now.getTime() ? " · overdue" : soon ? " · this week" : ""}
                    </span>
                  </p>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid content-start gap-14">
          <section>
            <h2 className="font-display text-2xl">Campus</h2>
            {home.savedEvents.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                Save an event on Campus Life and the next one appears here.{" "}
                <Link href="/workspace/events" className="text-ink underline-offset-4 hover:underline">
                  Open Campus Life
                </Link>
              </p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {home.savedEvents.map((event) => (
                  <li key={event.id}>
                    <Link href="/workspace/events" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                      {event.title}
                    </Link>
                    <p className="text-sm text-ink-soft">{event.startsAt.toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-2xl">Communities</h2>
            {home.communities.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                You have not joined a community yet.{" "}
                <Link href="/workspace/communities" className="text-ink underline-offset-4 hover:underline">
                  Browse communities
                </Link>
              </p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {home.communities.map((community) => (
                  <li key={community.id}>
                    <Link href={`/workspace/communities/${community.id}`} className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                      {community.name}
                    </Link>
                    <p className="text-sm text-ink-soft">
                      {community.members} member{community.members === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-2xl">Opportunities</h2>
            {home.opportunities.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                Nothing is posted yet. When a scholarship, internship, or research opening is added, it will show here.{" "}
                <Link href="/workspace/opportunities" className="text-ink underline-offset-4 hover:underline">
                  Open Opportunities
                </Link>
              </p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {home.opportunities.map((opportunity) => (
                  <li key={opportunity.id}>
                    <Link href="/workspace/opportunities" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                      {opportunity.title}
                    </Link>
                    <p className="text-sm text-ink-soft">
                      {opportunity.kind}
                      {opportunity.official ? " · Official" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-2xl">People</h2>
            <p className="mt-4 text-sm leading-6 text-ink-soft">
              {home.needsTags
                ? "Add an interest or a subject so a suggestion can name the tag you share."
                : "A suggestion appears when someone in your age band shares a tag with you. The reason names that tag."}{" "}
              <Link href={home.needsTags ? "/workspace/profile#tags" : "/workspace/people"} className="text-ink underline-offset-4 hover:underline">
                {home.needsTags ? "Add matching tags" : "Open People"}
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
