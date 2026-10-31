import { cn } from "@/lib/cn";

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-6",
        tone === "info" && "border-line bg-canvas text-ink",
        tone === "success" && "border-pine/30 bg-pine/10 text-pine-deep",
        tone === "danger" && "border-coral/30 bg-coral/10 text-coral",
      )}
    >
      {children}
    </div>
  );
}
