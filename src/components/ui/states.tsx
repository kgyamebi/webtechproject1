import { ButtonLink } from "@/components/ui/button";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="border-t border-line py-8">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">{body}</p>
      {actionHref && actionLabel ? (
        <div className="mt-5">
          <ButtonLink href={actionHref} variant="secondary">
            {actionLabel}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="border-t border-coral py-6" role="alert">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">{body}</p>
    </div>
  );
}
