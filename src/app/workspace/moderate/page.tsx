import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { loadModerationQueue, moderateCaseAction } from "@/server/connect/actions";

export const metadata = { title: "Moderation" };

export default async function ModeratePage() {
  const queue = await loadModerationQueue();
  if (!queue) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Moderation</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Only a platform administrator can open this page. Counts below come from the database. They are not sample numbers.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardTitle>{queue.waiting}</CardTitle>
          <CardText>People waiting</CardText>
        </Card>
        <Card>
          <CardTitle>{queue.active}</CardTitle>
          <CardText>Open conversations</CardText>
        </Card>
        <Card>
          <CardTitle>{queue.reportsToday}</CardTitle>
          <CardText>Connect reports in 24 hours</CardText>
        </Card>
      </div>
      {queue.cases.map((item) => (
        <Card key={item.id}>
          <CardTitle>{item.status.toLowerCase()}</CardTitle>
          <CardText>
            {item.report?.reason ?? "Report missing"} · {item.createdAt.toLocaleString()}
          </CardText>
          <p className="mt-2 text-xs text-ink-soft">Session {item.report?.targetId}</p>
          <ul className="mt-2 text-xs text-ink-soft">
            {item.actions.map((action) => (
              <li key={action.id}>
                {action.kind}: {action.note}
              </li>
            ))}
          </ul>
          <form action={moderateCaseAction} className="mt-4 grid gap-2">
            <input type="hidden" name="caseId" value={item.id} />
            <Field label="Note" name={`note-${item.id}`}>
              <Textarea id={`note-${item.id}`} name="note" defaultValue={item.notes} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="kind" value="REVIEW" size="sm" variant="secondary">
                Mark reviewing
              </Button>
              <Button type="submit" name="kind" value="ESCALATE" size="sm" variant="secondary">
                Escalate
              </Button>
              <Button type="submit" name="kind" value="SUSPEND" size="sm" variant="danger">
                Suspend reported person
              </Button>
              <Button type="submit" name="kind" value="REINSTATE" size="sm" variant="secondary">
                Reinstate
              </Button>
              <Button type="submit" name="kind" value="CLOSE" size="sm">
                Close case
              </Button>
            </div>
          </form>
        </Card>
      ))}
      <Link className="text-sm text-pine underline-offset-4 hover:underline" href="/workspace/connect">
        Back to Connect
      </Link>
    </div>
  );
}
