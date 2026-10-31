"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Menu, MenuLink } from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/server/identity/actions";

type NavLink = { href: string; label: string; adultOnly?: boolean; group: string };

const links: NavLink[] = [
  { href: "/workspace", label: "Home", group: "Home" },
  { href: "/workspace/learn", label: "Learn", group: "Learn" },
  { href: "/workspace/calendar", label: "Calendar", group: "Learn" },
  { href: "/workspace/people", label: "People", group: "Connect" },
  { href: "/workspace/friends", label: "Friends", group: "Connect" },
  { href: "/workspace/connect", label: "Connect", adultOnly: true, group: "Connect" },
  { href: "/workspace/quiet", label: "Quiet Connect", adultOnly: true, group: "Connect" },
  { href: "/workspace/messages", label: "Messages", group: "Connect" },
  { href: "/workspace/feed", label: "Feed", group: "Campus" },
  { href: "/workspace/stories", label: "Stories", group: "Campus" },
  { href: "/workspace/communities", label: "Communities", group: "Campus" },
  { href: "/workspace/events", label: "Campus Life", group: "Campus" },
  { href: "/workspace/opportunities", label: "Opportunities", group: "Campus" },
  { href: "/workspace/profile", label: "Profile", group: "Profile" },
  { href: "/workspace/settings", label: "Settings", group: "Profile" },
  { href: "/workspace/notifications", label: "Notifications", group: "Profile" },
  { href: "/workspace/integrations", label: "LMS", group: "Profile" },
  { href: "/workspace/help", label: "Help", group: "Profile" },
];

const primary = [
  { href: "/workspace", label: "Home" },
  { href: "/workspace/learn", label: "Learn" },
  { href: "/workspace/messages", label: "Messages" },
  { href: "/workspace/profile", label: "Profile" },
];

export function AppShell({
  name,
  band,
  children,
}: {
  name: string;
  band: "adult" | "minor";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const visible = links.filter((link) => band === "adult" || !link.adultOnly);
  const groups = ["Home", "Learn", "Connect", "Campus", "Profile"];

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("campus-nav") === "collapsed");
    setNavReady(true);
  }, []);

  useEffect(() => {
    if (!navReady) {
      return;
    }
    window.localStorage.setItem("campus-nav", collapsed ? "collapsed" : "open");
  }, [collapsed, navReady]);

  return (
    <div className="workspace-shell min-h-full md:grid md:grid-cols-[auto_1fr]">
      <aside className={`hidden bg-paper md:flex md:flex-col md:px-4 md:py-7 ${collapsed ? "md:w-[4.5rem]" : "md:w-60"}`}>
        <div className="flex items-center justify-between gap-2 px-2">
          <Link href="/workspace" className="min-w-0">
            {collapsed ? <span className="font-display text-xl text-ink">C+</span> : <Wordmark />}
          </Link>
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center text-ink-soft hover:text-ink"
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setCollapsed((value) => !value)}
          >
            <MenuIcon />
          </button>
        </div>
        <nav aria-label="Workspace" className="mt-8 grid gap-7">
          {groups.map((group) => (
            <div key={group} className="grid gap-0.5">
              {collapsed || group === "Home" ? null : (
                <p className="kicker px-3 pb-2">{group === "Connect" && band === "minor" ? "People" : group}</p>
              )}
              {visible
                .filter((link) => link.group === group)
                .map((link) => {
                  const current = link.href === "/workspace" ? pathname === "/workspace" : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={current ? "page" : undefined}
                      title={link.label}
                      className={
                        current
                          ? "nav-link flex items-center gap-2.5 px-3 py-1.5 text-[15px] font-medium text-ink shadow-[inset_2px_0_0_var(--ink)]"
                          : "nav-link flex items-center gap-2.5 px-3 py-1.5 text-[15px] text-ink-soft hover:text-ink"
                      }
                    >
                      <NavIcon href={link.href} />
                      <span className={collapsed ? "sr-only" : ""}>{link.label}</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        {collapsed ? null : (
          <p className="mt-auto px-3 pt-6 text-xs leading-5 text-ink-soft">
            {band === "minor"
              ? "Under-18 account. Random Connect and Quiet Connect stay off, and social contact with adults stays closed."
              : "Adult account. Social tools follow the choices in Settings."}
          </p>
        )}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 px-6 py-4 md:px-12">
          <details className="md:hidden">
            <summary className="cursor-pointer list-none border border-line px-3 py-1.5 text-sm">Menu</summary>
            <nav aria-label="Workspace mobile" className="mt-2 grid max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-paper p-2">
              {visible.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm">
                  {link.label}
                </Link>
              ))}
            </nav>
          </details>
          <p className="hidden text-sm text-ink-soft md:block">
            {visible.find((link) => (link.href === "/workspace" ? pathname === "/workspace" : pathname.startsWith(link.href)))?.label ?? "Campus+"}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Menu label={name}>
              <MenuLink href="/workspace/profile">Profile</MenuLink>
              <MenuLink href="/workspace/settings">Settings</MenuLink>
            </Menu>
            <form action={signOutAction}>
              <button type="submit" className="px-3 py-2 text-sm text-ink-soft hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="w-full max-w-6xl flex-1 px-6 pb-28 md:px-12 md:pb-16">
          <div className="page-enter">{children}</div>
        </main>
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-canvas px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          {primary.map((link) => {
            const current = link.href === "/workspace" ? pathname === "/workspace" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={current ? "px-2 py-2 text-center text-xs font-medium text-ink" : "px-2 py-2 text-center text-xs text-ink-soft"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

function NavIcon({ href }: { href: string }) {
  const paths: Record<string, string> = {
    "/workspace": "M3 8.5 8 4l5 4.5V14H3z",
    "/workspace/learn": "M3 4.5h6.5v9H3zM9.5 6H13v7.5H9.5z",
    "/workspace/calendar": "M3 4h10v9H3zM3 7h10",
    "/workspace/people": "M8 8a2.2 2.2 0 1 0 0-4.4A2.2 2.2 0 0 0 8 8zM4 13c.4-2 1.8-3 4-3s3.6 1 4 3",
    "/workspace/friends": "M5.5 8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM10.5 8.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM2.8 13c.3-1.7 1.4-2.6 2.7-2.6S8 11.3 8.2 13M8 13c.2-1.4 1.1-2.2 2.4-2.2 1.2 0 2.1.8 2.4 2.2",
    "/workspace/connect": "M3 5.5h10v6H6l-3 2z",
    "/workspace/quiet": "M8 3.5a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4z",
    "/workspace/messages": "M2.5 4.5h11v7h-7l-4 2z",
    "/workspace/feed": "M3 4h10M3 8h10M3 12h7",
    "/workspace/stories": "M8 3.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6z",
    "/workspace/communities": "M3 3h4.2v4.2H3zM8.8 3H13v4.2H8.8zM3 8.8h4.2V13H3zM8.8 8.8H13V13H8.8z",
    "/workspace/events": "M8 2.8 9.4 6h3.4L10.2 8.2 11.4 12 8 9.8 4.6 12l1.2-3.8L3.2 6h3.4z",
    "/workspace/opportunities": "M8 2.5 9.2 6H13l-3 2.2 1.2 3.8L8 9.8 4.8 12 6 8.2 3 6h3.8z",
    "/workspace/notifications": "M8 3a3 3 0 0 0-3 3v2.2L4 10.5h8L11 8.2V6a3 3 0 0 0-3-3zM6.8 12a1.2 1.2 0 0 0 2.4 0",
    "/workspace/integrations": "M3 4h10v8H3zM6 7h4",
    "/workspace/profile": "M8 8.2a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM4 13.2c.5-2 1.9-3 4-3s3.5 1 4 3",
    "/workspace/settings": "M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM8 2.5v1.6M8 11.9v1.6M2.5 8h1.6M11.9 8h1.6",
  };
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d={paths[href] ?? "M3 8h10"} />
    </svg>
  );
}
