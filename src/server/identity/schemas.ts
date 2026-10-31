import { z } from "zod";

/**
 * Shared input schemas. Server actions parse FormData with these objects.
 * The browser may also use HTML constraints, but these checks are the ones
 * that actually run before a write.
 */

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.")
  .max(254, "That email address is too long.");

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter the name you want classmates to see.")
      .max(80, "Use 80 characters or fewer."),
    email: emailSchema,
    password: passwordSchema,
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth."),
    institutionId: z.string().trim().max(64).optional().or(z.literal("")),
  })
  .refine((value) => value.password.toLowerCase() !== value.email.toLowerCase(), {
    path: ["password"],
    message: "Do not use your email address as your password.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "This reset link is missing its token."),
    password: passwordSchema,
  });

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the name you want classmates to see.")
    .max(80, "Use 80 characters or fewer."),
  biography: z.string().trim().max(500, "Keep your biography under 500 characters."),
  programme: z.string().trim().max(120, "Use 120 characters or fewer."),
  department: z.string().trim().max(120, "Use 120 characters or fewer."),
  institutionId: z.string().trim().max(64).optional().or(z.literal("")),
});

export const privacySchema = z.object({
  discoverable: z.boolean(),
  showEmail: z.boolean(),
});

export const notificationSchema = z.object({
  notifyFriendRequests: z.boolean(),
  notifyMessages: z.boolean(),
  notifyAcademic: z.boolean(),
  notifyCommunities: z.boolean(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm."),
  confirmation: z.string().refine((value) => value.trim().toLowerCase() === "delete my account", {
    message: 'Type "delete my account" to confirm.',
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

export type FieldErrors = Record<string, string>;

export type FormState = {
  formError?: string;
  fieldErrors?: FieldErrors;
  success?: string;
};

export const initialFormState: FormState = {};

export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

export function readBoolean(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true";
}

export function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
