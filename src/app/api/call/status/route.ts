import { NextResponse } from "next/server";
import { mediaServerStatus } from "@/server/media/status";

export async function GET() {
  const status = await mediaServerStatus();
  return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
}
