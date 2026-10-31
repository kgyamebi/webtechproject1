import { Button } from "@/components/ui/button";
import { QueueWait } from "@/components/connect/queue-wait";
import { cancelConnectQueueAction } from "@/server/connect/actions";

export const metadata = { title: "Waiting" };

export default function WaitingPage() {
  return (
    <div className="grid h-full content-start gap-6 overflow-y-auto p-4">
      <h1 className="font-display text-4xl">Looking for someone</h1>
      <QueueWait />
      <form action={cancelConnectQueueAction}>
        <Button type="submit" variant="secondary">
          Leave the queue
        </Button>
      </form>
    </div>
  );
}
