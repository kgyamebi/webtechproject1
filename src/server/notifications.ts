import "server-only";

import { prisma } from "@/server/db/client";
import { deliverAuthEmail } from "@/server/email/mailer";

export async function notifyUser(input: {
  userId: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
  mail?: boolean;
  preference?: "notifyFriendRequests" | "notifyMessages" | "notifyAcademic" | "notifyCommunities";
}) {
  if (input.preference) {
    const profile = await prisma.profile.findUnique({
      where: { userId: input.userId },
      select: {
        notifyFriendRequests: true,
        notifyMessages: true,
        notifyAcademic: true,
        notifyCommunities: true,
      },
    });
    if (profile && profile[input.preference] === false) {
      return;
    }
  }

  await prisma.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? "",
    },
  });

  if (!input.mail) {
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true },
  });
  if (!user?.email) {
    return;
  }
  await deliverAuthEmail({
    to: user.email,
    subject: input.title,
    text: `${input.body}\n\nCampus+ copied this notice to email. Push and SMS are not sent.`,
  });
}
