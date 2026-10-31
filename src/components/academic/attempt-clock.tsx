"use client";

import { useEffect, useState } from "react";

export function AttemptClock({ startedAt, limitMinutes }: { startedAt: string; limitMinutes: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const end = new Date(startedAt).getTime() + limitMinutes * 60 * 1000;
  const left = Math.max(0, end - now);
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const clock = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <p className={left === 0 ? "text-sm text-coral" : "text-sm text-ink"}>
      {left === 0
        ? "The time limit has passed. The server will refuse this attempt."
        : `${clock} left of ${limitMinutes} minutes. The server closes the attempt when the limit is reached.`}
    </p>
  );
}
