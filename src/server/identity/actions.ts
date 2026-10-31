"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db/client";
import { safeWorkspacePath } from "@/server/http/redirects";
import {
  assessAge,
  institutionAllowsRegistration,
  parseDateOnly,
  resolveDiscoverability,
  ageBandFromBirth,
} from "@/server/identity/policy";
import { getOrCreateProfile } from "@/server/identity/records";
import {
  deleteAccountSchema,
  fieldErrorsFromZod,
  forgotPasswordSchema,
  loginSchema,
  notificationSchema,
  privacySchema,
  profileSchema,
  readBoolean,
  readString,
  registerSchema,
  resetPasswordSchema,
  type FormState,
} from "@/server/identity/schemas";
import { saveAvatar } from "@/server/media/storage";

function authStatus(error: unknown): number {
  if (error && typeof error === "object") {
    const record = error as { status?: unknown; statusCode?: unknown };
    const status = Number(record.status ?? record.statusCode);
    if (Number.isFinite(status) && status >= 400) {
      return status;
    }
  }

  return 500;
}

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: readString(formData, "name"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
    dateOfBirth: readString(formData, "dateOfBirth"),
    institutionId: readString(formData, "institutionId"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const dateOfBirth = parseDateOnly(parsed.data.dateOfBirth);
  if (!dateOfBirth) {
    return { fieldErrors: { dateOfBirth: "Enter a real calendar date." } };
  }

  const age = assessAge(dateOfBirth);
  if (!age.ok) {
    return { fieldErrors: { dateOfBirth: age.reason } };
  }

  const institutionId = parsed.data.institutionId || null;
  if (institutionId) {
    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution || !institutionAllowsRegistration(institution.kind)) {
      return { fieldErrors: { institutionId: "Choose an institution from the list." } };
    }
  }

  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        dateOfBirth,
        callbackURL: "/login?notice=verified",
      },
      headers: await headers(),
    });

    const persisted = await prisma.user.findUnique({ where: { id: result.user.id } });
    if (persisted) {
      await getOrCreateProfile(persisted.id, dateOfBirth);
      if (institutionId) {
        await prisma.institutionMembership.create({
          data: {
            userId: persisted.id,
            institutionId,
            role: "STUDENT",
            status: "PENDING",
            isPrimary: true,
          },
        });
      }
    }
  } catch (error) {
    if (authStatus(error) === 429) {
      return { formError: "Too many attempts. Wait a few minutes and try again." };
    }

    console.error("Registration failed.");
    return { formError: "The account could not be created. Check the form and try again." };
  }

  redirect("/check-email");
}

export async function completeTourAction() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return;
  }
  await prisma.profile.update({
    where: { userId: session.user.id },
    data: { tourSeenAt: new Date() },
  });
  revalidatePath("/workspace");
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch (error) {
    const status = authStatus(error);
    if (status === 429) {
      return { formError: "Too many attempts. Wait a few minutes and try again." };
    }
    if (status === 403) {
      return {
        formError: "Verify your email before signing in. In local development, open the mailbox page.",
      };
    }
    return { formError: "Those details were not accepted. Check the email and password." };
  }

  redirect(safeWorkspacePath(readString(formData, "next")));
}

export async function forgotPasswordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: readString(formData, "email"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: "/reset-password",
      },
      headers: await headers(),
    });
  } catch (error) {
    if (authStatus(error) === 429) {
      return { formError: "Too many attempts. Wait a few minutes and try again." };
    }
  }

  return {
    success: "If an account exists for that address, a reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: readString(formData, "token"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await auth.api.resetPassword({
      body: {
        token: parsed.data.token,
        newPassword: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (authStatus(error) === 429) {
      return { formError: "Too many attempts. Wait a few minutes and try again." };
    }
    return { formError: "This reset link is invalid or has expired. Request a new one." };
  }

  redirect("/login?notice=password-reset");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function updateProfileAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { formError: "Sign in again, then save your profile." };
  }

  const parsed = profileSchema.safeParse({
    name: readString(formData, "name"),
    biography: readString(formData, "biography"),
    programme: readString(formData, "programme"),
    department: readString(formData, "department"),
    institutionId: readString(formData, "institutionId"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const institutionId = parsed.data.institutionId || null;
  if (institutionId) {
    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution || !institutionAllowsRegistration(institution.kind)) {
      return { fieldErrors: { institutionId: "Choose an institution from the list." } };
    }
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: session.user.id },
        data: { name: parsed.data.name },
      });
      await transaction.profile.update({
        where: { userId: session.user.id },
        data: {
          biography: parsed.data.biography,
          programme: parsed.data.programme,
          department: parsed.data.department,
        },
      });

      const current = await transaction.institutionMembership.findFirst({
        where: { userId: session.user.id, isPrimary: true },
      });

      if (current?.status === "VERIFIED" && current.institutionId !== institutionId) {
        throw new Error("VERIFIED_AFFILIATION");
      }

      if (!institutionId) {
        if (current && current.status !== "VERIFIED") {
          await transaction.institutionMembership.delete({ where: { id: current.id } });
        }
        return;
      }

      if (current?.institutionId === institutionId) {
        return;
      }

      if (current && current.status !== "VERIFIED") {
        await transaction.institutionMembership.delete({ where: { id: current.id } });
      }

      await transaction.institutionMembership.create({
        data: {
          userId: session.user.id,
          institutionId,
          role: "STUDENT",
          status: "PENDING",
          isPrimary: true,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFIED_AFFILIATION") {
      return {
        fieldErrors: {
          institutionId: "A verified affiliation can only be changed by an institution administrator.",
        },
      };
    }

    console.error("Profile update failed.");
    return { formError: "The profile could not be saved. Try again." };
  }

  if (session.user.emailVerified) {
    const { syncAffiliationAfterVerification } = await import("@/server/identity/records");
    await syncAffiliationAfterVerification(session.user.id, session.user.email);
  }

  return { success: "Profile saved." };
}

export async function updatePrivacyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { formError: "Sign in again, then save your privacy choices." };
  }

  const band = ageBandFromBirth(new Date(session.user.dateOfBirth));
  if (!band) {
    return { formError: "The date of birth on this account needs to be corrected first." };
  }

  const parsed = privacySchema.safeParse({
    discoverable: readBoolean(formData, "discoverable"),
    showEmail: readBoolean(formData, "showEmail"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  await prisma.profile.update({
    where: { userId: session.user.id },
    data: {
      discoverable: resolveDiscoverability(parsed.data.discoverable, band),
      showEmail: parsed.data.showEmail,
    },
  });

  return {
    success:
      band === "minor"
        ? "Privacy saved. Discovery stays off until you are 18."
        : "Privacy saved.",
  };
}

export async function updateNotificationsAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { formError: "Sign in again, then save your notification choices." };
  }

  const parsed = notificationSchema.safeParse({
    notifyFriendRequests: readBoolean(formData, "notifyFriendRequests"),
    notifyMessages: readBoolean(formData, "notifyMessages"),
    notifyAcademic: readBoolean(formData, "notifyAcademic"),
    notifyCommunities: readBoolean(formData, "notifyCommunities"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  await prisma.profile.update({
    where: { userId: session.user.id },
    data: parsed.data,
  });

  return { success: "Notification choices saved. Email delivery is not turned on yet." };
}

export async function uploadAvatarAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { formError: "Sign in again, then upload a photo." };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return { fieldErrors: { avatar: "Choose an image to upload." } };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await saveAvatar(session.user.id, bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The image could not be saved.";
    return { fieldErrors: { avatar: message } };
  }

  return { success: "Profile image saved." };
}

export async function deleteAccountAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { formError: "Sign in again before deleting an account." };
  }

  const parsed = deleteAccountSchema.safeParse({
    password: readString(formData, "password"),
    confirmation: readString(formData, "confirmation"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await auth.api.deleteUser({
      body: { password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (authStatus(error) === 400 || authStatus(error) === 401) {
      return { fieldErrors: { password: "That password was not accepted." } };
    }
    return { formError: "The account could not be deleted. Try again." };
  }

  redirect("/?notice=account-deleted");
}
