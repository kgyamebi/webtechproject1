"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function QueueWait() {
  const router = useRouter();
  const [since, setSince] = useState<string | null>(null);
  const [state, setState] = useState("Connecting to the queue…");

  useEffect(() => {
    const source = new EventSource("/api/connect/queue/stream");
    source.addEventListener("waiting", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { since: string | null };
      setSince(data.since);
      setState("Waiting for another available adult. Nobody is being invented to fill the gap.");
    });
    source.addEventListener("matched", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { sessionId: string };
      setState("Match found. Opening the conversation…");
      router.push(`/workspace/connect/session/${data.sessionId}`);
    });
    source.addEventListener("idle", () => {
      setState("You are not in the queue.");
    });
    source.onerror = () => {
      setState("The live queue connection dropped. You can leave and try again.");
    };
    return () => source.close();
  }, [router]);

  return (
    <div className="rounded-3xl border border-line bg-paper p-6" role="status">
      <p className="font-display text-2xl">In the queue</p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{state}</p>
      {since ? <p className="mt-2 text-xs text-ink-soft">Joined {new Date(since).toLocaleTimeString()}</p> : null}
    </div>
  );
}
