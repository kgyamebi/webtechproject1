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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function writtenDay(date: Date) {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function shortDay(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

function clock(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function time(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const today = writtenDay(now);
  const summary = [
    `${home.courses} course${home.courses === 1 ? "" : "s"} on your desk`,
    home.progress.published > 0
      ? `${home.progress.submitted} of ${home.progress.published} published assignment${home.progress.published === 1 ? "" : "s"} submitted`
      : "",
    home.unread > 0 ? `${home.unread} unread notification${home.unread === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" · ");
  const meter = home.progress.published > 0 ? home.progress.submitted / home.progress.published : 0;

  return (
    <div className="pt-2 md:pt-6">
      <header className="home-mast home-rise">
        <p className="kicker">{today}</p>
        <h1 className="greeting mt-5">
          <span className="block">{daypart(now)},</span>
          <span className="block">{first}.</span>
          <span className="sr-only">Hello, {home.name}</span>
        </h1>
        <div className="home-rule" aria-hidden="true" />
        <p className="home-lead">{summary}</p>
      </header>

      <section className="home-next home-rise" style={{ animationDelay: "120ms" }}>
        <div>
          <p className="kicker">Your next deadline</p>
          {next ? (
            <>
              <h2 className="home-next-title">{next.title}</h2>
              <p className="home-meta">{next.kind} · {next.detail}</p>
              <p className="home-meta">{clock(next.at)}</p>
              <p className="home-meta">{until(next.at, now)}</p>
              <Link href={next.href} className="home-go">Open it</Link>
            </>
          ) : (
            <>
              <h2 className="home-next-title">Nothing is due.</h2>
              <p className="home-note">
                You have cleared the deadlines currently on your desk. Courses you join will put the next piece of work here.
              </p>
              <Link href="/workspace/learn" className="home-go">Go to Learn</Link>
            </>
          )}
        </div>
        <dl className="home-figures">
          <div>
            <dt>Courses</dt>
            <dd>{home.courses}</dd>
          </div>
          <div>
            <dt>{home.progress.published > 0 ? `of ${home.progress.published} submitted` : "Submitted"}</dt>
            <dd>
              {home.progress.submitted}
              {home.progress.published > 0 ? (
                <span className="home-meter" style={{ ["--meter" as string]: String(meter) }}>
                  <span />
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Unread</dt>
            <dd>{home.unread}</dd>
          </div>
        </dl>
      </section>

      {loop.soonQuiz ? (
        <section className="home-alert home-rise" style={{ animationDelay: "180ms" }}>
          <p className="kicker">This course steps forward</p>
          <h2 className="mt-3 font-display text-3xl">{loop.soonQuiz.courseTitle}</h2>
          <p className="home-note">
            {loop.soonQuiz.title} closes {clock(loop.soonQuiz.closeAt)}. The feed is stepped back until then.
          </p>
          <Link href={loop.soonQuiz.href} className="home-go">Open the quiz</Link>
        </section>
      ) : null}

      {loop.together.length > 0 ? (
        <ul className="home-note">
          {loop.together.map((session) => (
            <li key={`${session.name}-${session.assignmentTitle}`}>
              {session.name} is on {session.assignmentTitle}. Until {time(session.endsAt)}. No camera.
            </li>
          ))}
        </ul>
      ) : null}
      {loop.friendLines.length > 0 ? (
        <ul className="home-note">
          {loop.friendLines.map((line) => (
            <li key={`${line.name}-${line.quizTitle}`}>{line.name} has a quiz coming up · {line.quizTitle}</li>
          ))}
        </ul>
      ) : null}

      <div className="home-links home-rise" style={{ animationDelay: "200ms" }}>
        <span>{home.band === "adult" ? "Adult account." : "Under-18 account."}</span>
        <Link href="/workspace/notifications" className="text-ink underline-offset-4 hover:underline">
          {home.unread} unread
        </Link>
        <Link href="/workspace/messages" className="text-ink underline-offset-4 hover:underline">
          Messages · {home.unreadMessages} unread
        </Link>
        {home.band === "adult" ? (
          <Link href="/workspace/connect" className="text-ink underline-offset-4 hover:underline">
            Open Connect
          </Link>
        ) : null}
        <Link href="/workspace/week" className="text-ink underline-offset-4 hover:underline">
          {loop.sunday ? "Your week is ready" : "Your week"}
        </Link>
        <ReplayTourButton />
      </div>

      {home.quiet ? (
        <p className="home-note">
          Open introduction with {home.quiet.label}. A real name stays hidden until both people agree.{" "}
          <Link href={home.quiet.href} className="text-ink underline-offset-4 hover:underline">
            Open your introduction
          </Link>
        </p>
      ) : null}

      <section className="home-list home-rise" style={{ animationDelay: "240ms" }}>
        <h2>On the desk</h2>
        {desk.length === 0 ? (
          <p className="home-note">No upcoming deadlines. You have cleared everything currently scheduled.</p>
        ) : (
          <div className="mt-4">
            {desk.map((item) => {
              const late = item.at.getTime() < now.getTime();
              const soon = item.at.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
              return (
                <div key={`${item.kind}-${item.id}`} className="home-row">
                  <p className="home-when">
                    {shortDay(item.at)}
                  </p>
                  <p className="min-w-0 text-sm">
                    <Link href={item.href} className="font-medium text-ink underline-offset-4 hover:underline">
                      {item.title}
                    </Link>
                    <span className="mt-0.5 block text-ink-soft">
                      {item.kind} · {item.detail}
                      {" · "}
                      {time(item.at)}
                      {late ? " · overdue" : soon ? " · this week" : ""}
                    </span>
                  </p>
                  <p className={late ? "home-flag is-late" : "home-flag"}>
                    {late ? "Overdue" : soon ? "This week" : item.kind}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="home-grid home-rise" style={{ animationDelay: "320ms" }}>
        <section className="home-panel">
          <h2>Campus</h2>
          {home.savedEvents.length === 0 ? (
            <p className="home-note">
              Save an event on Campus Life and the next one appears here.{" "}
              <Link href="/workspace/events" className="text-ink underline-offset-4 hover:underline">
                Open Campus Life
              </Link>
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {home.savedEvents.map((event) => (
                <li key={event.id}>
                  <Link href="/workspace/events" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                    {event.title}
                  </Link>
                  <p className="text-sm text-ink-soft">{clock(event.startsAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="home-panel">
          <h2>Communities</h2>
          {home.communities.length === 0 ? (
            <p className="home-note">
              You have not joined a community yet.{" "}
              <Link href="/workspace/communities" className="text-ink underline-offset-4 hover:underline">
                Browse communities
              </Link>
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
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

        <section className="home-panel">
          <h2>Opportunities</h2>
          {home.opportunities.length === 0 ? (
            <p className="home-note">
              Nothing is posted yet. When a scholarship, internship, or research opening is added, it will show here.{" "}
              <Link href="/workspace/opportunities" className="text-ink underline-offset-4 hover:underline">
                Open Opportunities
              </Link>
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
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

        <section className="home-panel">
          <h2>People</h2>
          <p className="home-note">
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
  );
}
