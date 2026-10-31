"use client";

import { useMemo, useState } from "react";
import { categoryPercent, weightedTotal } from "@/server/academic/rules";

type Group = {
  name: string;
  weight: number;
  items: Array<{ id: string; title: string; points: number; maxPoints: number }>;
};

export function WhatIf({ groups }: { groups: Group[] }) {
  const usable = groups.filter((group) => group.items.length > 0 && group.weight > 0);
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of usable) {
      for (const item of group.items) {
        initial[item.id] = String(item.points);
      }
    }
    return initial;
  });
  const total = useMemo(() => {
    const categories = usable.map((group) => ({
      weight: group.weight,
      percent: categoryPercent(
        group.items.map((item) => ({
          points: bounded(scores[item.id], item.maxPoints, item.points),
          maxPoints: item.maxPoints,
        })),
      ),
    }));
    return weightedTotal(categories);
  }, [scores, usable]);

  if (usable.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-line py-5">
      <h2 className="font-display text-xl">Try different scores</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">
        These figures are the numbers you type. Campus+ does not predict a grade, and nothing here is saved.
      </p>
      <div className="mt-4 grid max-w-lg gap-3">
        {usable.map((group) => (
          <div key={group.name}>
            <p className="text-sm font-medium">{group.name} · weight {group.weight}</p>
            {group.items.map((item) => (
              <label key={item.id} className="mt-2 grid gap-1 text-sm">
                <span className="text-ink-soft">{item.title} out of {item.maxPoints}</span>
                <input
                  className="h-10 rounded-[2px] border border-line bg-paper px-3 text-sm text-ink"
                  type="number"
                  min={0}
                  max={item.maxPoints}
                  value={scores[item.id] ?? ""}
                  onChange={(event) => setScores((current) => ({ ...current, [item.id]: event.target.value }))}
                />
              </label>
            ))}
          </div>
        ))}
        <p className="text-sm">If these were the scores, the course total would be {total === null ? "unavailable" : `${total}%`}.</p>
      </div>
    </section>
  );
}

function bounded(value: string | undefined, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(0, parsed));
}
