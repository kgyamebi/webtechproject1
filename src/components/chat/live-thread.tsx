"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendVoiceNoteAction } from "@/server/social/actions";

export function LiveThread({ conversationId }: { conversationId: string }) {
  const [names, setNames] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const response = await fetch(`/api/chat/typing?conversationId=${encodeURIComponent(conversationId)}`);
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { names?: string[] };
        if (!stop) {
          setNames(body.names ?? []);
        }
      } catch {
        return;
      }
    }
    const timer = window.setInterval(() => void tick(), 4000);
    void tick();
    const field = document.getElementById("body");
    const onInput = () => {
      void fetch("/api/chat/typing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
    };
    field?.addEventListener("input", onInput);
    return () => {
      stop = true;
      window.clearInterval(timer);
      field?.removeEventListener("input", onInput);
    };
  }, [conversationId]);

  async function toggle() {
    if (recorder.current && recorder.current.state === "recording") {
      recorder.current.stop();
      setRecording(false);
      return;
    }
    setNote("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const elapsed = Date.now() - started.current;
        if (elapsed > 31_000) {
          setNote("A voice note stays under 30 seconds.");
          return;
        }
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const data = new FormData();
        data.set("conversationId", conversationId);
        data.set("audio", new File([blob], "note.webm", { type: blob.type || "audio/webm" }));
        startTransition(() => {
          void sendVoiceNoteAction(data);
        });
      };
      started.current = Date.now();
      rec.start();
      recorder.current = rec;
      setRecording(true);
      window.setTimeout(() => {
        if (recorder.current?.state === "recording") {
          recorder.current.stop();
          setRecording(false);
        }
      }, 30_000);
    } catch {
      setNote("The microphone was not available.");
    }
  }

  return (
    <div className="grid gap-2">
      {names.length > 0 ? <p className="text-xs text-ink-soft">{names.join(", ")} is writing.</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => void toggle()} disabled={pending}>
          {recording ? "Stop voice note" : "Voice note"}
        </Button>
        <p className="text-xs text-ink-soft">Up to 30 seconds. It stays in this chat and is not a call.</p>
      </div>
      {note ? <p className="text-xs text-ink-soft">{note}</p> : null}
    </div>
  );
}
