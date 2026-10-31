import { notFound } from "next/navigation";
import { PublicFrame } from "@/components/shell/public-frame";
import { prisma } from "@/server/db/client";

export const metadata = { title: "Development mailbox" };

export default async function DevMailboxPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const messages = await prisma.devMailboxMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <PublicFrame title="Development mailbox">
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
        These messages exist only while NODE_ENV is development and SMTP is not configured. They
        contain sign-in links, so this page must never be deployed as a public mailbox.
      </p>
      {messages.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No messages yet. Create an account or request a password reset.</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {messages.map((message) => (
            <li key={message.id} className="rounded-3xl border border-line bg-paper p-5">
              <p className="text-sm text-ink-soft">
                {message.recipient} · {message.createdAt.toISOString()}
              </p>
              <h2 className="mt-1 font-display text-2xl">{message.subject}</h2>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.textBody}</pre>
            </li>
          ))}
        </ul>
      )}
    </PublicFrame>
  );
}
