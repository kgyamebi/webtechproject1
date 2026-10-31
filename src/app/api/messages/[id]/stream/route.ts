import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { partnerTyping } from "@/server/connect/presence";
import { prisma } from "@/server/db/client";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
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
      const finish = () => {
        if (closed) {
          return;
        }
        closed = true;
        clearInterval(timer);
        controller.close();
      };
      const tick = async () => {
        const membership = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
        });
        if (!membership) {
          send("error", { reason: "This conversation is not yours." });
          finish();
          return;
        }
        const found = await prisma.message.findMany({
          where: { conversationId: id, createdAt: { gt: last } },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        const messages = found.reverse();
        if (messages.length > 0) {
          last = messages[messages.length - 1]?.createdAt ?? last;
          for (const message of messages) {
            send("message", {
              id: message.id,
              body: message.deletedAt ? "Message deleted" : message.body,
              mine: message.senderId === session.user.id,
              createdAt: message.createdAt.toISOString(),
            });
          }
        }
        const others = await prisma.conversationMember.findMany({
          where: { conversationId: id, userId: { not: session.user.id } },
          select: { userId: true },
        });
        send("typing", { typing: others.some((person) => partnerTyping(`chat:${id}`, person.userId)) });
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
