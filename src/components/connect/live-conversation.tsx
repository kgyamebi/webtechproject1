"use client";

import { useEffect, useRef, useState } from "react";

type LiveMessage = { id: string; body: string; mine: boolean; createdAt: string };

export function LiveConversation({
  initial,
  streamUrl,
  typingUrl,
  closed,
  maxLength,
  action,
  fields,
  idempotent,
}: {
  initial: LiveMessage[];
  streamUrl: string;
  typingUrl?: string;
  closed: boolean;
  maxLength: number;
  action: (formData: FormData) => Promise<{ ok: boolean; reason?: string } | void>;
  fields: { name: string; value: string }[];
  idempotent?: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [live, setLive] = useState(closed ? "Closed" : "Live");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [clientKey, setClientKey] = useState("");
  const [clockReady, setClockReady] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const typedAt = useRef(0);

  useEffect(() => {
    setClockReady(true);
    if (idempotent) {
      setClientKey(crypto.randomUUID());
    }
  }, [idempotent]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, typing]);

  useEffect(() => {
    if (closed) {
      return;
    }
    const source = new EventSource(streamUrl);
    source.addEventListener("message", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as LiveMessage;
      setMessages((current) => (current.some((item) => item.id === data.id) ? current : [...current, data]));
    });
    source.addEventListener("typing", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { typing: boolean };
      setTyping(data.typing);
    });
    source.addEventListener("ended", () => {
      setLive("Ended");
      setTyping(false);
      source.close();
    });
    source.onerror = () => setLive("Reconnecting");
    source.onopen = () => setLive("Live");
    return () => source.close();
  }, [closed, streamUrl]);

  const grouped = messages.map((message, index) => {
    const previous = messages[index - 1];
    const showTime = !previous || new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60 * 1000;
    const sameSender = previous?.mine === message.mine && !showTime;
    return { ...message, showTime, sameSender };
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="sr-only" role="status">
        Connection {live}
      </p>
      <div ref={scroller} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-live="polite">
        {grouped.length === 0 ? <p className="px-2 py-8 text-center text-sm text-[var(--screen-soft)]">Say hello when you are ready.</p> : null}
        {grouped.map((message) => (
          <div key={message.id}>
            {message.showTime ? (
              <p className="py-2 text-center text-[11px] text-[var(--screen-soft)]">{clockReady ? new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</p>
            ) : null}
            <div className={message.mine ? "flex justify-end" : "flex justify-start"}>
              <p
                className={
                  message.mine
                    ? `max-w-[78%] whitespace-pre-wrap break-words bg-[var(--bubble-me)] px-3.5 py-2 text-[15px] leading-5 text-[var(--bubble-me-ink)] ${message.sameSender ? "rounded-[1.25rem] rounded-tr-md" : "rounded-[1.25rem]"}`
                    : `max-w-[78%] whitespace-pre-wrap break-words bg-[var(--bubble-them)] px-3.5 py-2 text-[15px] leading-5 text-[var(--bubble-them-ink)] shadow-sm ${message.sameSender ? "rounded-[1.25rem] rounded-tl-md" : "rounded-[1.25rem]"}`
                }
              >
                <MessageText body={message.body} />
              </p>
            </div>
          </div>
        ))}
      </div>
      {typing ? (
        <p className="px-4 pb-1 text-xs text-[var(--screen-soft)]" role="status">
          Typing…
        </p>
      ) : null}
      {closed || live === "Ended" ? (
        <p className="border-t border-[var(--hairline)] px-4 py-4 text-sm text-[var(--screen-soft)]">This conversation is closed.</p>
      ) : (
        <form
          className="border-t border-[var(--hairline)] bg-[var(--composer)] px-3 py-2"
          action={async (formData) => {
            setPending(true);
            const result = await action(formData);
            setPending(false);
            if (result && result.ok === false) {
              setError(result.reason ?? "The message was not sent.");
              return;
            }
            setError("");
            setDraft("");
            if (idempotent) {
              setClientKey(crypto.randomUUID());
            }
          }}
        >
          {fields.map((field) => (
            <input key={field.name} type="hidden" name={field.name} value={field.value} />
          ))}
          {idempotent ? <input type="hidden" name="clientKey" value={clientKey} /> : null}
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="connect-draft">
              Message
            </label>
            <textarea
              id="connect-draft"
              name="body"
              value={draft}
              maxLength={maxLength}
              rows={1}
              placeholder="Message"
              aria-label="Message"
              disabled={pending}
              onChange={(event) => {
                setDraft(event.target.value);
                if (typingUrl && Date.now() - typedAt.current > 1500) {
                  typedAt.current = Date.now();
                  void fetch(typingUrl, { method: "POST" });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-3xl border border-[var(--hairline)] bg-transparent px-4 py-2.5 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={pending || draft.trim().length === 0 || (Boolean(idempotent) && clientKey.length === 0)}
              className="h-11 shrink-0 rounded-full bg-[var(--bubble-me)] px-4 text-sm font-semibold text-[var(--bubble-me-ink)] disabled:opacity-40"
            >
              {pending ? "…" : "Send"}
            </button>
          </div>
          {error ? (
            <p className="px-2 pt-2 text-sm text-coral" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}

function MessageText({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} className="underline" target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}
