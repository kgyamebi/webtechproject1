import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { deleteFinishedConnectHistoryAction, loadConnectHistory } from "@/server/connect/actions";

export const metadata = { title: "Connection history" };

export default async function ConnectHistoryPage() {
  const rows = await loadConnectHistory();

  return (
    <div className="grid h-full content-start gap-6 overflow-y-auto p-4">
      <div>
        <h1 className="font-display text-4xl">Connection history</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          This list uses the alias from the chat, not a real name. Clearing finished rows removes them from your history.
          The messages stay available to moderators if a report was filed.
        </p>
      </div>
      {rows.some((row) => row.status !== "MATCH_FOUND" && row.status !== "SESSION_ACTIVE") ? (
        <form action={deleteFinishedConnectHistoryAction}>
          <Button type="submit" variant="secondary">
            Clear finished history
          </Button>
        </form>
      ) : null}
      {rows.length === 0 ? <EmptyState title="No connections yet" body="Finished Random Connect chats will be listed here." /> : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <CardTitle>{row.alias}</CardTitle>
          <CardText>
            {row.mode.toLowerCase().replaceAll("_", " ")} · {row.status.toLowerCase().replaceAll("_", " ")} ·{" "}
            {row.startedAt.toLocaleString()}
            {row.duration !== null ? ` · ${row.duration} seconds` : ""}
            {row.friendStatus === "NONE" ? "" : ` · friend request ${row.friendStatus.toLowerCase()}`}
          </CardText>
          {row.status === "MATCH_FOUND" || row.status === "SESSION_ACTIVE" ? (
            <Link className="mt-3 inline-block text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/connect/session/${row.id}`}>
              Reopen
            </Link>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
