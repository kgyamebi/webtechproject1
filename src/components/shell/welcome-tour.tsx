"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { completeTourAction } from "@/server/identity/actions";

type Band = "adult" | "minor";

export function WelcomeTour({
  name,
  band,
  seen,
}: {
  name: string;
  band: Band;
  seen: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(!seen);
  const [step, setStep] = useState(0);
  const [play, setPlay] = useState(0);
  const [mounted, setMounted] = useState(false);
  const steps = tourSteps(name, band);
  const current = steps[step];
  const first = name.split(" ")[0] || name;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const openTour = () => {
      setStep(0);
      setPlay((value) => value + 1);
      setOpen(true);
    };
    window.addEventListener("campus-tour", openTour);
    return () => window.removeEventListener("campus-tour", openTour);
  }, []);

  useEffect(() => {
    if (!open || pathname !== "/workspace") {
      delete document.documentElement.dataset.tour;
      return;
    }
    document.documentElement.dataset.tour = current.kind;
    return () => {
      delete document.documentElement.dataset.tour;
    };
  }, [open, pathname, current.kind]);

  if (!open || pathname !== "/workspace" || !mounted) {
    return null;
  }

  async function finish() {
    setOpen(false);
    await completeTourAction();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className="tour-card fixed bottom-24 right-4 z-40 w-[min(26rem,calc(100vw-2rem))] border border-line bg-paper p-5 md:bottom-6 md:right-8"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
          Step {step + 1} of {steps.length}
        </p>
        <button type="button" className="text-sm text-ink-soft underline-offset-4 hover:underline" onClick={() => void finish()}>
          Skip tour
        </button>
      </div>
      <div className="mt-3 h-px overflow-hidden bg-line" aria-hidden="true">
        <div className="tour-bar h-full bg-ink" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <div key={`${step}-${play}`} className="tour-step mt-4">
        <p className="text-xs text-ink-soft">{current.watch}</p>
        <TourStage kind={current.kind} first={first} />
        <h2 id="tour-title" className="mt-4 font-display text-2xl text-ink">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{current.body}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm text-ink-soft underline-offset-4 hover:underline"
          onClick={() => setPlay((value) => value + 1)}
        >
          Replay scene
        </button>
        <div className="flex gap-2">
          {step > 0 ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          ) : null}
          {step < steps.length - 1 ? (
            <Button type="button" size="sm" onClick={() => setStep((value) => value + 1)}>
              Next
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => void finish()}>
              Go to my desk
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ReplayTourButton() {
  return (
    <button
      type="button"
      className="text-sm text-ink underline-offset-4 hover:underline"
      onClick={() => window.dispatchEvent(new Event("campus-tour"))}
    >
      Take the tour
    </button>
  );
}

function TourStage({ kind, first }: { kind: StepKind; first: string }) {
  if (kind === "desk") {
    return (
      <Stage scene="desk" caption="Then the next deadline appears on the desk.">
        <p className="sim text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">Home</p>
        <p className="sim sim-d1 mt-1 font-display text-2xl leading-none text-ink">Hello, {first}</p>
        <div className="sim sim-d2 mt-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Next deadline</p>
          <p className="text-sm text-ink">The soonest piece of work</p>
          <div className="mt-2 h-px bg-line">
            <div className="sim-fill h-px w-2/3 bg-ink" />
          </div>
        </div>
      </Stage>
    );
  }

  if (kind === "learn") {
    return (
      <Stage scene="learn" caption="Learn opens the course. Calendar keeps the dates.">
        <div className="grid grid-cols-[5.5rem_1fr] gap-3">
          <div>
            <p className="sim-press px-1 py-1 text-xs font-medium text-ink">Learn</p>
            <p className="sim sim-d1 px-1 py-1 text-xs text-ink-soft">Calendar</p>
          </div>
          <div>
            <p className="sim sim-d2 text-[10px] uppercase tracking-[0.14em] text-brass">Course</p>
            <p className="sim sim-d2 text-sm text-ink">Your joined course</p>
            <p className="sim sim-d3 mt-2 flex items-center gap-2 text-xs text-ink-soft">
              <Check />
              Module opens
            </p>
            <p className="sim sim-d4 mt-1 flex items-center gap-2 text-xs text-ink-soft">
              <Check delay />
              Due time stays on the work
            </p>
          </div>
        </div>
      </Stage>
    );
  }

  if (kind === "connect") {
    return (
      <Stage scene="connect" caption="Both people keep an alias until they both agree.">
        <div className="flex items-center justify-center gap-3 pt-2">
          <span className="sim-meet grid h-10 w-10 place-items-center border border-line text-[10px] text-ink" style={{ ["--from-x" as string]: "-28px" }}>
            You
          </span>
          <span className="sim sim-d2 text-[10px] uppercase tracking-[0.14em] text-brass">Alias</span>
          <span className="sim-meet grid h-10 w-10 place-items-center border border-line text-[10px] text-ink" style={{ ["--from-x" as string]: "28px" }}>
            Guest
          </span>
        </div>
        <p className="sim sim-d3 mt-3 text-center text-xs text-ink-soft">A call can start when the media server is running. It is not recorded.</p>
      </Stage>
    );
  }

  if (kind === "minor") {
    return (
      <Stage scene="minor" caption="People shows your age band. The two Connect tools stay closed.">
        <p className="sim text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">Under 18</p>
        <p className="sim sim-d1 mt-2 text-sm text-ink">People stay in your age band</p>
        <p className="sim sim-d2 mt-3 border-t border-line pt-2 text-xs text-ink-soft">Random Connect stays closed</p>
        <p className="sim sim-d3 mt-1 text-xs text-ink-soft">Quiet Connect stays closed</p>
      </Stage>
    );
  }

  return (
    <Stage scene="campus" caption="Messages, saved events, then Settings.">
      <p className="sim flex justify-between text-sm text-ink">
        <span>Messages</span>
        <span className="text-xs text-ink-soft">Friends</span>
      </p>
      <p className="sim sim-d2 mt-2 flex justify-between border-t border-line pt-2 text-sm text-ink">
        <span>Campus Life</span>
        <span className="text-xs text-ink-soft">Save an event</span>
      </p>
      <p className="sim sim-d3 mt-2 flex justify-between border-t border-line pt-2 text-sm text-ink">
        <span>Settings</span>
        <span className="text-xs text-ink-soft">Privacy and download</span>
      </p>
    </Stage>
  );
}

function Stage({ scene, caption, children }: { scene: StepKind; caption: string; children: ReactNode }) {
  return (
    <div className="tour-stage" data-scene={scene} aria-hidden="true">
      <span className="tour-cursor" />
      {children}
      <p className="tour-caption sim sim-d4">{caption}</p>
    </div>
  );
}

function Check({ delay = false }: { delay?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path className={delay ? "sim-draw sim-draw-late" : "sim-draw"} d="M3 7.2 5.6 10 11 4" />
    </svg>
  );
}

type StepKind = "desk" | "learn" | "connect" | "minor" | "campus";

function tourSteps(name: string, band: Band): Array<{ title: string; body: string; watch: string; kind: StepKind }> {
  const first = name.split(" ")[0] || name;
  return [
    {
      kind: "desk",
      watch: "Look at Home. It has a brass outline.",
      title: `Welcome, ${first}`,
      body: "The scene in this box is a simulation. Your real greeting and your real next deadline stay on the desk behind it. The menu stays clickable.",
    },
    {
      kind: "learn",
      watch: "Look at Learn, then Calendar.",
      title: "Open Learn",
      body: "Learn opens a course you have joined. A module lists its materials. An assignment shows its due time. Calendar gathers those dates in one list.",
    },
    band === "adult"
      ? {
          kind: "connect",
          watch: "Look at People, then Connect.",
          title: "Meet with an alias",
          body: "People names the tag you share. Quiet Connect keeps an alias until both adults agree to real names. A call can start when the media server is running, and it is not recorded.",
        }
      : {
          kind: "minor",
          watch: "Look at People.",
          title: "People your age",
          body: "People stays inside the under-18 band. Random Connect and Quiet Connect stay closed, and social contact with adults stays closed.",
        },
    {
      kind: "campus",
      watch: "Look at Messages, Campus Life, and Settings.",
      title: "The rest of campus",
      body: "Messages open with friends. Campus Life is an event you can save. Settings holds privacy, a data download, and account deletion. The learning-system page builds a labelled sample.",
    },
  ];
}
