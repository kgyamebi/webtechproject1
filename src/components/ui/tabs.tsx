"use client";

import * as Tabs from "@radix-ui/react-tabs";

export function TabList({
  label,
  tabs,
  children,
}: {
  label: string;
  tabs: Array<{ value: string; label: string }>;
  children: React.ReactNode;
}) {
  return (
    <Tabs.Root defaultValue={tabs[0]?.value}>
      <Tabs.List aria-label={label} className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="rounded-full border border-transparent px-4 py-2 text-sm text-ink-soft data-[state=active]:border-line data-[state=active]:bg-paper data-[state=active]:text-ink"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <div className="mt-6">{children}</div>
    </Tabs.Root>
  );
}

export function TabPanel({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return <Tabs.Content value={value}>{children}</Tabs.Content>;
}
