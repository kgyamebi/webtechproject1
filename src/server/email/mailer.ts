import "server-only";

import nodemailer from "nodemailer";
import { prisma } from "@/server/db/client";

type AuthEmail = {
  to: string;
  subject: string;
  text: string;
};

/**
 * Verification and reset links contain secrets. Development stores them in
 * DevMailboxMessage so the project can be demonstrated without an email
 * provider. Production sends them through SMTP and does not keep the link.
 */
export async function deliverAuthEmail(message: AuthEmail): Promise<void> {
  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "Campus+ <noreply@localhost>",
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    await prisma.devMailboxMessage.create({
      data: {
        recipient: message.to,
        subject: message.subject,
        textBody: message.text,
      },
    });
    return;
  }

  console.error("SMTP is not configured, so a Campus+ authentication email was not sent.");
}
