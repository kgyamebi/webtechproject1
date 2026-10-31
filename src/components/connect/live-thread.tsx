"use client";

import { useEffect, useState } from "react";
import { sendConnectMessageAction } from "@/server/connect/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

type LiveMessage = { id: string; body: string; mine: boolean; createdAt: string };

export function LiveThread({
  sessionId,
  initial,
  closed,
}: {
  sessionId: string;
  initial: LiveMessage[];
  closed: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [live, setLive] = useState(closed ? "This conversation is closed." : "Live");
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");

  useEffect(() => {
    if (closed) {
      return;
    }
    const source = new EventSource(`/api/connect/session/${sessionId}/stream`);
    source.addEventListener("message", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as LiveMessage;
      setMessages((current) => (current.some((item) => item.id === data.id) ? current : [...current, data]));
    });
    source.addEventListener("ended", () => {
      setLive("The other person or you ended this conversation.");
      source.close();
    });
    source.onerror = () => setLive("Reconnecting…");
    source.onopen = () => setLive("Live");
    return () => source.close();
  }, [closed, sessionId]);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-soft" role="status">
        Connection: {live}. Messages are pushed over a server stream, not typed in by the app.
      </p>
      <ul className="grid max-h-[28rem] gap-3 overflow-y-auto" aria-live="polite">
        {messages.map((message) => (
          <li key={message.id} className={message.mine ? "ml-8 rounded-2xl bg-pine/10 px-3 py-2 text-sm" : "mr-8 rounded-2xl bg-canvas px-3 py-2 text-sm"}>
            <span className="font-medium">{message.mine ? "You" : "Guest"}</span>
            <p>{message.body}</p>
          </li>
        ))}
        {messages.length === 0 ? <li className="text-sm text-ink-soft">No messages yet. A prompt below is optional.</li> : null}
      </ul>
      {closed || live.startsWith("The other") ? null : (
        <form
          action={async (formData) => {
            const result = await sendConnectMessageAction(formData);
            if (!result.ok) {
              setError(result.reason);
              return;
            }
            setError("");
            setClientKey(crypto.randomUUID());
          }}
          className="grid gap-3"
        >
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="clientKey" value={clientKey} />
          <Textarea name="body" aria-label="Message" required maxLength={500} placeholder="Say hello" />
          {error ? <p className="text-sm text-coral" role="alert">{error}</p> : null}
          <Button type="submit">Send</Button>
        </form>
      )}
    </div>
  );
}
