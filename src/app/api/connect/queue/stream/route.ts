import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { queueSnapshot, tryMatch } from "@/server/connect/engine";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const finish = () => {
        if (closed) {
          return;
        }
        closed = true;
        clearInterval(timer);
        controller.close();
      };
      const tick = async () => {
        const found = await tryMatch(session.user.id);
        if (found.ok && "sessionId" in found) {
          send("matched", { sessionId: found.sessionId });
          finish();
          return;
        }
        const snapshot = await queueSnapshot(session.user.id);
        if (!snapshot.queued && !snapshot.sessionId) {
          send("idle", {});
          finish();
          return;
        }
        send("waiting", { since: snapshot.since });
      };
      const timer = setInterval(() => {
        void tick().catch(() => finish());
      }, 1500);
      request.signal.addEventListener("abort", finish);
      await tick().catch(() => finish());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
