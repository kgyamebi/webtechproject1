import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import {
  hidePersonAction,
  listClassmates,
  listRecommendations,
  reportPersonAction,
  sendFriendRequestAction,
  skipPersonAction,
} from "@/server/social/actions";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const people = await listRecommendations();
  const classmates = await listClassmates();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">People</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Recommendations use shared interests, subjects, and communities. Minors and adults are not shown to each other.
          Add tags on your profile so a match can be explained.
        </p>
      </div>
      {people.length === 0 ? (
        <EmptyState
          title="No recommendations yet"
          body="When someone shares a tag with you and is discoverable, they will appear here."
          actionHref="/workspace/profile#tags"
          actionLabel="Add matching tags"
        />
      ) : (
        people.map((person) => (
          <Card key={person.id}>
            <CardTitle>{person.name}</CardTitle>
            <CardText>{person.programme || "Programme not listed"}</CardText>
            <ul className="mt-3 list-disc pl-5 text-sm">
              {person.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">Shared-tag weight {person.score}. A higher weight means more overlap, not a better person.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={sendFriendRequestAction}>
                <input type="hidden" name="userId" value={person.id} />
                <Button type="submit" size="sm">
                  Add friend
                </Button>
              </form>
              <form action={skipPersonAction}>
                <input type="hidden" name="userId" value={person.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Skip for now
                </Button>
              </form>
              <form action={hidePersonAction}>
                <input type="hidden" name="userId" value={person.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Don&apos;t show again
                </Button>
              </form>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-ink-soft">Report</summary>
              <form action={reportPersonAction} className="mt-3 grid gap-2">
                <input type="hidden" name="targetId" value={person.id} />
                <input type="hidden" name="targetType" value="USER" />
                <Field label="Report" name={`reason-${person.id}`}>
                  <Input id={`reason-${person.id}`} name="reason" placeholder="Why are you reporting this profile?" required minLength={5} />
                </Field>
                <Button type="submit" size="sm" variant="danger">
                  Send report
                </Button>
              </form>
            </details>
          </Card>
        ))
      )}
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">In your courses</h2>
        <p className="text-sm leading-6 text-ink-soft">
          Classmates appear when they are discoverable and in the same age band. A minor and an adult in the same course stay apart.
        </p>
        {classmates.length === 0 ? (
          <EmptyState title="No classmates to show" body="People in your courses appear here when discovery is on and the age rules allow it." />
        ) : (
          classmates.map((person) => (
            <Card key={person.id}>
              <CardTitle>{person.name}</CardTitle>
              <CardText>
                {person.programme || "Programme not listed"} · {person.courses.join(", ")}
              </CardText>
              {person.friend ? (
                <p className="mt-3 text-sm text-ink-soft">Already a friend. Message them from Friends.</p>
              ) : (
                <form action={sendFriendRequestAction} className="mt-4">
                  <input type="hidden" name="userId" value={person.id} />
                  <Button type="submit" size="sm">
                    Add friend
                  </Button>
                </form>
              )}
            </Card>
          ))
        )}
      </section>
      <Card>
        <CardTitle>What this list is</CardTitle>
        <CardText>
          Scores are design weights, not a measure of compatibility. Skip removes someone for now. Hide keeps them out. A block,
          which lives on Friends, stops contact in both directions.
        </CardText>
      </Card>
    </div>
  );
}
