import { describe, expect, it } from "vitest";
import { registerSchema } from "@/server/identity/schemas";

const valid = {
  name: "Ada Mensah",
  email: "ada@riverside.edu",
  password: "Campus-seed-2026",
  dateOfBirth: "2002-04-12",
  institutionId: "inst_riverside",
};

describe("registration validation", () => {
  it("accepts a complete registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a short password and a password copied from the email", () => {
    const shortPassword = registerSchema.safeParse({ ...valid, password: "short1" });
    expect(shortPassword.success).toBe(false);

    const copiedEmail = registerSchema.safeParse({
      ...valid,
      email: "campus2026@riverside.edu",
      password: "campus2026@riverside.edu",
    });
    expect(copiedEmail.success).toBe(false);
  });

  it("rejects a password without a number", () => {
    const result = registerSchema.safeParse({ ...valid, password: "longpassword" });
    expect(result.success).toBe(false);
  });

  it("rejects an impossible date string", () => {
    const result = registerSchema.safeParse({ ...valid, dateOfBirth: "12/04/2002" });
    expect(result.success).toBe(false);
  });
});
