import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("border-t border-line py-5", className)}>
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-ink">{children}</h2>;
}

export function CardText({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-6 text-ink-soft">{children}</p>;
}
