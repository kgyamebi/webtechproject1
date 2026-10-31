import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { noteTyping } from "@/server/connect/presence";
import { prisma } from "@/server/db/client";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  const { id } = await context.params;
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
  });
  if (!membership) {
    return new Response(null, { status: 403 });
  }
  noteTyping(`chat:${id}`, session.user.id);
  return new Response(null, { status: 204 });
}
