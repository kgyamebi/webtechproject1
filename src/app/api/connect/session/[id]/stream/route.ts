import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { messagesAfter } from "@/server/connect/engine";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  const { id } = await context.params;
  const encoder = new TextEncoder();
  let last = new Date(0);
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const tick = async () => {
        const snapshot = await messagesAfter(id, session.user.id, last);
        if (!snapshot) {
          send("error", { reason: "This conversation is not yours." });
          finish();
          return;
        }
        if (snapshot.messages.length > 0) {
          last = new Date(snapshot.messages[snapshot.messages.length - 1]?.createdAt ?? last);
          for (const message of snapshot.messages) {
            send("message", message);
          }
        }
        send("typing", { typing: snapshot.typing });
        if (snapshot.status !== "MATCH_FOUND" && snapshot.status !== "SESSION_ACTIVE") {
          send("ended", { status: snapshot.status });
          finish();
        }
      };

      const finish = () => {
        if (closed) {
          return;
        }
        closed = true;
        clearInterval(timer);
        controller.close();
      };

      const timer = setInterval(() => {
        void tick().catch(() => finish());
      }, 1000);
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
