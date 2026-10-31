import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { createEventAction, listEvents, saveEventAction } from "@/server/campus/actions";

export const metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view;
  const events = await listEvents();
  const now = Date.now();
  const filtered = events.filter((event) => {
    if (view === "saved") {
      return event.saved;
    }
    if (view === "official") {
      return event.official;
    }
    return true;
  });
  const upcoming = filtered.filter((event) => event.startsAt.getTime() >= now - 60 * 60 * 1000);
  const earlier = filtered.filter((event) => event.startsAt.getTime() < now - 60 * 60 * 1000);
  const savedCount = events.filter((event) => event.saved).length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Campus Life</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          {savedCount} saved. Official is recorded only when a lecturer or a platform administrator adds it. Saved events also
          appear on your home page and are marked on the calendar.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Filter href="/workspace/events" current={view !== "saved" && view !== "official"}>
            All
          </Filter>
          <Filter href="/workspace/events?view=saved" current={view === "saved"}>
            Saved
          </Filter>
          <Filter href="/workspace/events?view=official" current={view === "official"}>
            Official
          </Filter>
        </div>
      </div>
      <Card>
        <CardTitle>Add an event</CardTitle>
        <CardText>Official is saved only for a lecturer or a platform administrator.</CardText>
        <form action={createEventAction} className="mt-4 grid gap-3">
          <Field label="Title" name="title">
            <Input id="title" name="title" required />
          </Field>
          <Field label="Description" name="description">
            <Textarea id="description" name="description" />
          </Field>
          <Field label="Kind" name="kind">
            <Select id="kind" name="kind" defaultValue="campus">
              <option value="campus">Campus</option>
              <option value="club">Club</option>
              <option value="study">Study</option>
              <option value="social">Social</option>
            </Select>
          </Field>
          <Field label="Starts" name="startsAt">
            <Input id="startsAt" name="startsAt" type="datetime-local" required />
          </Field>
          <Field label="Location" name="location">
            <Input id="location" name="location" />
          </Field>
          <Field label="Link" name="linkUrl" hint="Only http and https links are stored.">
            <Input id="linkUrl" name="linkUrl" type="url" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="official" /> Mark official
          </label>
          <Button type="submit">Save event</Button>
        </form>
      </Card>
      <EventList title="Coming up" events={upcoming} empty="Nothing in this view is coming up." now={now} />
      {earlier.length > 0 ? <EventList title="Earlier" events={earlier} empty="" now={now} /> : null}
    </div>
  );
}

function Filter({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={current ? "rounded-full bg-pine px-3 py-1.5 text-[var(--on-accent)]" : "rounded-full border border-line px-3 py-1.5"}
    >
      {children}
    </Link>
  );
}

function EventList({
  title,
  events,
  empty,
  now,
}: {
  title: string;
  events: Array<{
    id: string;
    title: string;
    description: string;
    startsAt: Date;
    location: string;
    official: boolean;
    linkUrl: string;
    saved: boolean;
    kind: string;
    clashes: string[];
  }>;
  empty: string;
  now: number;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-2xl">{title}</h2>
      {events.length === 0 ? <EmptyState title={title} body={empty} /> : null}
      {events.map((event) => (
        <Card key={event.id}>
          <CardTitle>{event.title}</CardTitle>
          <CardText>
            {event.startsAt.toLocaleString()} · {whenLabel(event.startsAt, now)} · {event.location || "Location to be announced"} · {event.kind}
            {event.official ? " · official" : ""}
            {event.saved ? " · saved" : ""}
          </CardText>
          <p className="mt-2 text-sm">{event.description}</p>
          {event.linkUrl ? (
            <a className="mt-2 inline-block text-sm text-pine underline-offset-4 hover:underline" href={event.linkUrl}>
              Event link
            </a>
          ) : null}
          {event.clashes.length > 0 ? (
            <p className="mt-2 text-sm text-ink">This overlaps {event.clashes.join(", ")}. Saving still adds it to your desk.</p>
          ) : null}
          <form action={saveEventAction} className="mt-3">
            <input type="hidden" name="eventId" value={event.id} />
            <Button type="submit" size="sm" variant="secondary">
              {event.saved ? "Unsave" : "Save"}
            </Button>
          </form>
        </Card>
      ))}
    </section>
  );
}

function whenLabel(startsAt: Date, now: number) {
  const hours = Math.round((startsAt.getTime() - now) / 3_600_000);
  if (hours <= -1) {
    return "Already started";
  }
  if (hours < 1) {
    return "Starting within the hour";
  }
  if (hours < 48) {
    return `In ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(hours / 24);
  return `In ${days} days`;
}
