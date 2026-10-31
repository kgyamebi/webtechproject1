import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db/client";
import { deliverAuthEmail } from "@/server/email/mailer";
import { syncAffiliationAfterVerification } from "@/server/identity/records";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const trustedOrigins = [baseURL];
try {
  const parsed = new URL(baseURL);
  const port = parsed.port ? `:${parsed.port}` : "";
  if (parsed.hostname === "localhost") {
    trustedOrigins.push(`${parsed.protocol}//127.0.0.1${port}`);
  }
  if (parsed.hostname === "127.0.0.1") {
    trustedOrigins.push(`${parsed.protocol}//localhost${port}`);
  }
} catch {
  // A bad BETTER_AUTH_URL stays as the only trusted origin.
}

/**
 * Better Auth owns passwords, sessions, verification tokens, and reset tokens.
 * Campus+ does not implement that cryptography. The nextCookies plugin has to
 * stay last so server actions can persist the session cookie.
 */
export const auth = betterAuth({
  appName: "Campus+",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await deliverAuthEmail({
        to: user.email,
        subject: "Reset your Campus+ password",
        text: `Use this link to choose a new Campus+ password. It expires soon.\n\n${url}\n\nIf you did not ask for this, you can ignore the message.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await deliverAuthEmail({
        to: user.email,
        subject: "Verify your Campus+ email",
        text: `Confirm this email address for Campus+.\n\n${url}\n\nVerifying the address does not enrol you in a course.`,
      });
    },
    afterEmailVerification: async (user) => {
      await syncAffiliationAfterVerification(user.id, user.email);
    },
  },
  user: {
    additionalFields: {
      dateOfBirth: {
        type: "date",
        required: true,
        input: true,
      },
      platformRole: {
        type: ["USER", "PLATFORM_ADMIN"],
        required: false,
        defaultValue: "USER",
        input: false,
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 600, max: 8 },
      "/sign-up/email": { window: 600, max: 8 },
      "/request-password-reset": { window: 600, max: 4 },
    },
  },
  plugins: [nextCookies()],
});

export type SessionUser = typeof auth.$Infer.Session.user;
