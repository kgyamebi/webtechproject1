"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { joinConnectQueueAction } from "@/server/connect/actions";
import { startDirectMessageAction } from "@/server/social/actions";
import { signOutAction } from "@/server/identity/actions";

export type InboxThread = {
  id: string;
  href: string;
  title: string;
  preview: string;
  at: string;
  unread: boolean;
  kind: "friend" | "group" | "random";
};

export function InboxScreen({
  threads,
  friends,
  notice,
}: {
  threads: InboxThread[];
  friends: { id: string; name: string }[];
  notice?: string;
}) {
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searching, setSearching] = useState(false);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return threads.filter((thread) => {
      if (unreadOnly && !thread.unread) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return `${thread.title} ${thread.preview}`.toLowerCase().includes(needle);
    });
  }, [query, threads, unreadOnly]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--screen-soft)]">Campus+ Connect</p>
          <h1 className="font-display text-[1.7rem] leading-none text-[var(--screen-ink)]">Connect</h1>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-[var(--screen-ink)]" aria-label="Search conversations" aria-pressed={searching} onClick={() => setSearching((value) => !value)}>
            <SearchIcon />
          </button>
          <form action={signOutAction} className="md:hidden">
            <button type="submit" className="rounded-full px-2 py-2 text-sm text-[var(--screen-soft)]">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {searching ? (
        <div className="px-4 pb-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search conversations"
            placeholder="Search your conversations"
            className="h-11 w-full rounded-full border border-[var(--hairline)] bg-[var(--composer)] px-4 text-sm outline-none"
          />
        </div>
      ) : null}
      {notice ? (
        <p className="mx-4 mb-2 rounded-2xl bg-coral/15 px-3 py-2 text-sm" role="alert">
          {notice}
        </p>
      ) : null}
      {friends.length > 0 ? (
        <div className="pb-3">
          <p className="px-4 pb-2 text-xs font-medium text-[var(--screen-soft)]">Friends</p>
          <ul className="flex gap-3 overflow-x-auto px-4 pb-1">
            {friends.map((friend) => (
              <li key={friend.id} className="w-16 shrink-0">
                <form action={startDirectMessageAction}>
                  <input type="hidden" name="userId" value={friend.id} />
                  <input type="hidden" name="surface" value="connect" />
                  <button type="submit" className="grid justify-items-center gap-1 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--bubble-them)] text-sm font-semibold text-[var(--bubble-them-ink)] shadow-sm">
                      {initials(friend.name)}
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-4 text-[var(--screen-ink)]">{friend.name}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex items-center justify-between px-4 pb-2">
        <button type="button" className="text-xs font-medium text-[var(--screen-soft)]" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((value) => !value)}>
          {unreadOnly ? "Showing unread" : "All conversations"}
        </button>
        <form action={joinConnectQueueAction} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="meet-mode">
            How do you want to connect?
          </label>
          <select id="meet-mode" name="mode" defaultValue="SURPRISE" className="h-9 max-w-28 rounded-full border border-[var(--hairline)] bg-transparent px-2 text-xs">
            <option value="SURPRISE">Surprise</option>
            <option value="SAME_CAMPUS">Campus</option>
            <option value="STUDY">Study</option>
            <option value="INTERESTS">Interests</option>
            <option value="CAREER">Career</option>
            <option value="GLOBAL">Global</option>
          </select>
          <button type="submit" className="rounded-full bg-[var(--bubble-me)] px-3 py-2 text-xs font-semibold text-[var(--bubble-me-ink)]">
            Meet someone new
          </button>
        </form>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-3xl text-[var(--screen-ink)]">Your next great conversation starts here.</p>
            <p className="mt-3 text-sm leading-6 text-[var(--screen-soft)]">Friends and Random Connect chats you are allowed to see will show up in this list.</p>
          </div>
        ) : null}
        {threads.length > 0 && visible.length === 0 ? <p className="px-4 py-8 text-sm text-[var(--screen-soft)]">No conversations match that search.</p> : null}
        <ul>
          {visible.map((thread) => (
            <li key={`${thread.kind}-${thread.id}`}>
              <Link href={thread.href} className="flex items-center gap-3 px-4 py-3 hover:bg-black/5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--bubble-them)] text-sm font-semibold">
                  {initials(thread.title)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{thread.title}</span>
                    <RelativeTime iso={thread.at} />
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-sm text-[var(--screen-soft)]">{thread.preview}</span>
                    {thread.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--bubble-me)]" aria-label="Unread" /> : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <footer className="flex justify-between border-t border-[var(--hairline)] px-4 py-3 text-xs">
        <Link href="/workspace/connect/safety" className="text-[var(--screen-soft)]">
          Safety and privacy
        </Link>
        <Link href="/workspace/connect/history" className="text-[var(--screen-soft)]">
          History
        </Link>
      </footer>
    </div>
  );
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "C";
}

function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(relativeTime(iso));
  }, [iso]);
  return <span className="shrink-0 text-[11px] text-[var(--screen-soft)]">{label}</span>;
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) {
    return "Now";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return new Date(iso).toLocaleDateString();
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" />
      <path d="M12.2 12.2 16 16" />
    </svg>
  );
}
