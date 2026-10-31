"use client";

import * as Dialog from "@radix-ui/react-dialog";

export function ConfirmDialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 border border-line bg-paper p-6">
          <Dialog.Title className="font-display text-2xl text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-ink-soft">
            {description}
          </Dialog.Description>
          <div className="mt-6">{children}</div>
          <Dialog.Close className="mt-4 text-sm text-ink-soft underline-offset-4 hover:underline">
            Cancel
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
