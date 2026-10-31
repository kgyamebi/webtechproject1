import "server-only";

import { mediaHealthUrl, mediaSecret } from "@/lib/media-protocol";

export async function mediaServerStatus(): Promise<{ up: boolean; turn: boolean }> {
  if (!mediaSecret()) {
    return { up: false, turn: false };
  }
  try {
    const response = await fetch(mediaHealthUrl(), { cache: "no-store", signal: AbortSignal.timeout(1500) });
    if (!response.ok) {
      return { up: false, turn: false };
    }
    const body = (await response.json()) as { ok?: boolean; turn?: boolean };
    return { up: body.ok === true, turn: body.turn === true };
  } catch {
    return { up: false, turn: false };
  }
}
