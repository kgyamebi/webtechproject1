import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { listCalendar } from "@/server/campus/actions";
import { addPersonalEventAction } from "@/server/academic/studio";

export const metadata = { title: "Calendar" };

type Item = { id: string; title: string; at: Date; href: string; detail: string; course: string | null; work: boolean };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; course?: string; anchor?: string }>;
}) {
  const { view, course, anchor } = await searchParams;
  const mode = view === "month" || view === "week" || view === "day" ? view : "agenda";
  const calendar = await listCalendar();
  const items: Item[] = [
    ...calendar.assignments.map((item) => ({
      id: item.id,
      title: item.title,
      at: item.dueAt,
      href: `/workspace/learn/${item.courseId}/assignments/${item.id}`,
      detail: item.course.title,
      course: item.course.title,
      work: true,
    })),
    ...calendar.quizzes.flatMap((item) =>
      item.closeAt
        ? [{
            id: item.id,
            title: item.title,
            at: item.closeAt,
            href: `/workspace/learn/${item.courseId}/quizzes/${item.id}`,
            detail: item.course.title,
            course: item.course.title,
            work: true,
          }]
        : [],
    ),
    ...calendar.events.map((item) => ({
      id: item.id,
      title: item.title,
      at: item.startsAt,
      href: "/workspace/events",
      detail: item.official ? "Official campus event" : "Campus event",
      course: null,
      work: false,
    })),
    ...calendar.personal.map((item) => ({
      id: item.id,
      title: item.title,
      at: item.startsAt,
      href: "/workspace/calendar",
      detail: "Personal",
      course: null,
      work: false,
    })),
    ...calendar.hours.map((item) => ({
      id: item.id,
      title: `Office hour · ${item.hostName}`,
      at: item.startsAt,
      href: `/workspace/learn/${item.courseId}/hours`,
      detail: item.claimantName ? `Claimed by ${item.claimantName}` : "Open slot",
      course: item.course.title,
      work: false,
    })),
  ].sort((left, right) => left.at.getTime() - right.at.getTime());
  const courses = [...new Set(items.flatMap((item) => (item.course ? [item.course] : [])))];
  const visible = course ? items.filter((item) => item.course === course || item.detail === "Personal") : items;
  const focus = parseDay(anchor);
  const now = Date.now();

  return (
    <div>
      <h1>Calendar</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        Agenda is the full list. Day, week, and month move around a day you choose. A personal event can repeat weekly, and it stays only on your calendar.
      </p>
      <nav aria-label="Calendar views" className="mt-4 flex gap-4 text-sm">
        <Link className={mode === "agenda" ? "font-medium text-ink" : "text-ink-soft"} href={course ? `/workspace/calendar?course=${encodeURIComponent(course)}` : "/workspace/calendar"}>Agenda</Link>
        <Link className={mode === "day" ? "font-medium text-ink" : "text-ink-soft"} href={viewHref("day", focus, course)}>Day</Link>
        <Link className={mode === "week" ? "font-medium text-ink" : "text-ink-soft"} href={viewHref("week", focus, course)}>Week</Link>
        <Link className={mode === "month" ? "font-medium text-ink" : "text-ink-soft"} href={viewHref("month", focus, course)}>Month</Link>
      </nav>
      {courses.length > 0 ? (
        <nav aria-label="Calendar courses" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className={course ? "text-ink-soft" : "font-medium text-ink"} href={mode === "agenda" ? "/workspace/calendar" : viewHref(mode, focus)}>All courses</Link>
          {courses.map((title) => (
            <Link key={title} className={course === title ? "font-medium text-ink" : "text-ink-soft"} href={mode === "agenda" ? `/workspace/calendar?course=${encodeURIComponent(title)}` : viewHref(mode, focus, title)}>
              {title}
            </Link>
          ))}
        </nav>
      ) : null}
      {mode === "agenda" ? <Agenda items={visible} now={now} /> : mode === "day" ? <Day items={visible} focus={focus} course={course} now={now} /> : <Grid items={visible} mode={mode} focus={focus} course={course} now={now} />}
      <form action={addPersonalEventAction} className="mt-12 grid max-w-md gap-3 border-t border-line pt-6">
        <h2 className="font-display text-xl">Personal event</h2>
        <Field label="Title" name="personal-title"><Input id="personal-title" name="title" required minLength={2} /></Field>
        <Field label="Starts" name="personal-start"><Input id="personal-start" name="startsAt" type="datetime-local" required /></Field>
        <Field label="Ends" name="personal-end"><Input id="personal-end" name="endsAt" type="datetime-local" /></Field>
        <Field label="Weeks" name="personal-weeks" hint="1 is a single event. Up to 8 places the same event on the following weeks.">
          <Input id="personal-weeks" name="weeks" type="number" min={1} max={8} defaultValue={1} />
        </Field>
        <Button type="submit" variant="secondary">Add to my calendar</Button>
      </form>
    </div>
  );
}

function Agenda({ items, now }: { items: Item[]; now: number }) {
  return (
    <div className="mt-6">
      {items.length === 0 ? <p className="text-sm text-ink-soft">Nothing scheduled.</p> : null}
      {items.map((item) => (
        <div key={`${item.detail}-${item.id}`} className="ruled-row">
          <p className="text-xs text-ink-soft">
            <span className="block text-ink">{item.at.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            {item.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-sm">
            <Link className="font-medium text-ink underline-offset-4 hover:underline" href={item.href}>{item.title}</Link>
            <span className="mt-0.5 block text-ink-soft">{item.detail}{workTiming(item, now)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function Day({ items, focus, course, now }: { items: Item[]; focus: Date; course?: string; now: number }) {
  const previous = addDays(focus, -1);
  const next = addDays(focus, 1);
  const dayItems = items.filter((item) => sameDay(item.at, focus));
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <p className="font-medium">{focus.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <p className="flex gap-4">
          <Link className="text-ink-soft underline-offset-4 hover:underline" href={viewHref("day", previous, course)}>Previous</Link>
          <Link className="text-ink-soft underline-offset-4 hover:underline" href={viewHref("day", new Date(), course)}>Today</Link>
          <Link className="text-ink-soft underline-offset-4 hover:underline" href={viewHref("day", next, course)}>Next</Link>
        </p>
      </div>
      {dayItems.length === 0 ? <p className="mt-4 text-sm text-ink-soft">Nothing on this day.</p> : null}
      {dayItems.map((item) => (
        <div key={item.id} className="ruled-row">
          <p className="text-xs text-ink-soft">{item.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
          <p className="text-sm">
            <Link className="font-medium text-ink underline-offset-4 hover:underline" href={item.href}>{item.title}</Link>
            <span className="mt-0.5 block text-ink-soft">{item.detail}{workTiming(item, now)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function Grid({ items, mode, focus, course, now }: { items: Item[]; mode: "week" | "month"; focus: Date; course?: string; now: number }) {
  const start = new Date(focus);
  if (mode === "week") {
    start.setDate(focus.getDate() - focus.getDay());
  } else {
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);
  const days = mode === "week" ? 7 : new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setDate(mode === "month" ? index + 1 : start.getDate() + index);
    return day;
  });
  const previous = mode === "week" ? addDays(start, -7) : new Date(focus.getFullYear(), focus.getMonth() - 1, 1);
  const next = mode === "week" ? addDays(start, 7) : new Date(focus.getFullYear(), focus.getMonth() + 1, 1);
  const today = new Date();

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <p className="font-medium">
          {mode === "week"
            ? `Week of ${start.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
            : focus.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <p className="flex gap-4">
          <Link className="text-ink-soft underline-offset-4 hover:underline" href={viewHref(mode, previous, course)}>Previous</Link>
          <Link className="text-ink-soft underline-offset-4 hover:underline" href={viewHref(mode, new Date(), course)}>Today</Link>
          <Link className="text-ink-soft underline-offset-4 hover:underline" href={viewHref(mode, next, course)}>Next</Link>
        </p>
      </div>
      <div className={`mt-3 grid gap-px bg-line ${mode === "week" ? "grid-cols-1 sm:grid-cols-7" : "grid-cols-2 sm:grid-cols-7"}`}>
        {cells.map((day) => {
          const dayItems = items.filter((item) => sameDay(item.at, day));
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()} className={`min-h-24 p-2 ${isToday ? "bg-paper" : "bg-canvas"}`}>
              <p className={`text-xs ${isToday ? "font-medium text-ink" : "text-ink-soft"}`}>
                {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
              </p>
              {dayItems.map((item) => (
                <p key={item.id} className="mt-1">
                  <Link href={item.href} className="block text-xs text-ink underline-offset-2 hover:underline">
                    {item.title}
                  </Link>
                  {workTiming(item, now) ? <span className="block text-[10px] text-ink-soft">{workTiming(item, now).slice(3)}</span> : null}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function viewHref(mode: "day" | "week" | "month", day: Date, course?: string) {
  const params = new URLSearchParams({ view: mode, anchor: dayKey(day) });
  if (course) {
    params.set("course", course);
  }
  return `/workspace/calendar?${params.toString()}`;
}

function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date();
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function workTiming(item: Item, now: number) {
  if (!item.work) {
    return "";
  }
  const hours = (item.at.getTime() - now) / 3_600_000;
  if (hours < 0) {
    return " · overdue";
  }
  if (hours < 24 * 7) {
    return " · this week";
  }
  return "";
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}
