import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { connectSimulatedLmsAction, disconnectSimulatedLmsAction, listLms } from "@/server/campus/actions";

export const metadata = { title: "LMS" };

export default async function IntegrationsPage() {
  const connections = await listLms();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Learning system</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Campus+ does not connect to a live Canvas, Moodle, or Google Classroom account. The button below creates a clearly
          labelled sample course so you can see what an import would look like. Disconnecting removes only that simulated course.
        </p>
      </div>
      <Card>
        <CardTitle>What the sample includes</CardTitle>
        <CardText>
          SIM-101 Sample imported course, with a note, the assignment Read the sample note, the quiz Sample check, and an announcement. You are enrolled as a student. The score on the quiz stays hidden. Disconnecting deletes that course and leaves every real Campus+ course in place.
        </CardText>
      </Card>
      {connections.some((connection) => connection.provider === "SIMULATED" && connection.status === "CONNECTED") ? null : (
        <form action={connectSimulatedLmsAction}>
          <Button type="submit">Connect simulated Canvas</Button>
        </form>
      )}
      {connections.map((connection) => (
        <Card key={connection.id}>
          <CardTitle>{connection.label}</CardTitle>
          <CardText>
            {connection.provider === "SIMULATED" ? "Simulated provider. Not a live connection." : connection.provider} ·{" "}
            {connection.status}
          </CardText>
          <ul className="mt-3 text-sm text-ink-soft">
            {connection.records.map((record) => (
              <li key={record.id}>
                {record.localType === "COURSE" ? (
                  <Link className="text-pine underline-offset-4 hover:underline" href={`/workspace/learn/${record.localId}`}>
                    Open {record.externalId}
                  </Link>
                ) : (
                  <span>
                    {record.localType} {record.externalId}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <form action={disconnectSimulatedLmsAction} className="mt-4">
            <input type="hidden" name="connectionId" value={connection.id} />
            <Button type="submit" variant="danger">
              Disconnect and remove simulated courses
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
