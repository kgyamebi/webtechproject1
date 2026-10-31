"use client";

import { useEffect, useState } from "react";
import { CallRoom } from "@/components/call/call-room";

export function CallAvailability({
  scope,
  id,
  open,
  appearance,
}: {
  scope: "connect" | "course";
  id: string;
  open: boolean;
  appearance: "phone" | "desk";
}) {
  const [media, setMedia] = useState<{ up: boolean; turn: boolean } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let ignore = false;
    fetch("/api/call/status")
      .then((response) => response.json())
      .then((body: { up?: boolean; turn?: boolean }) => {
        if (!ignore) {
          setMedia({ up: body.up === true, turn: body.turn === true });
        }
      })
      .catch(() => {
        if (!ignore) {
          setMedia({ up: false, turn: false });
        }
      });
    return () => {
      ignore = true;
    };
  }, [open]);

  const soft = appearance === "phone" ? "px-1 pt-1 text-[11px] text-[var(--screen-soft)]" : "mt-3 max-w-xl text-sm leading-6 text-ink-soft";

  if (!open) {
    return <p className={soft}>This conversation is closed, so a call cannot start.</p>;
  }
  if (media && !media.up) {
    return <p className={soft}>Voice and video are not available. The media server is not running, and calls are not simulated.</p>;
  }
  return <CallRoom scope={scope} id={id} relay={media?.turn === true} appearance={appearance} />;
}
