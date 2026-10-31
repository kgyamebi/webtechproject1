import { NextResponse } from "next/server";
import { issueCallTicket } from "@/server/media/issue";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const scope = body && typeof body === "object" ? (body as { scope?: unknown }).scope : null;
  const id = body && typeof body === "object" ? (body as { id?: unknown }).id : null;
  if ((scope !== "connect" && scope !== "course") || typeof id !== "string") {
    return NextResponse.json({ error: "Name the conversation or the course." }, { status: 400 });
  }
  const result = await issueCallTicket({ scope, id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.ticket);
}
