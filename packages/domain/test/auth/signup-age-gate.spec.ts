import { describe, it, expect } from "vitest";
import { SignupInputSchema } from "../../src/auth/signup.schema.js";

describe("UC-01: Age Gate & Signup Domain Logic", () => {
  const validPayload = {
    email: "user@example.com",
    password: "correcthorsebattery", // NIST-compliant: long passphrase, no forced symbols
    ageConfirmed: true as const,
    termsAccepted: true as const,
    policyVersion: "v1.0",
    locale: "en" as const,
  };

  it("accepts valid registration with age gate confirmation (18+)", () => {
    const result = SignupInputSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.ageConfirmed).toBe(true);
    }
  });

  it("rejects registration if age gate is unconfirmed (false)", () => {
    const result = SignupInputSchema.safeParse({
      ...validPayload,
      ageConfirmed: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("at least 18");
    }
  });

  it("rejects registration if age gate is missing", () => {
    const { ageConfirmed: _, ...incompletePayload } = validPayload;
    const result = SignupInputSchema.safeParse(incompletePayload);
    expect(result.success).toBe(false);
  });

  it("rejects registration if terms are not accepted", () => {
    const result = SignupInputSchema.safeParse({
      ...validPayload,
      termsAccepted: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "accept the Terms of Service",
      );
    }
  });

  it("enforces minimum 12 character password length (NIST SP 800-63B)", () => {
    const result = SignupInputSchema.safeParse({
      ...validPayload,
      password: "tooshort",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("12 characters");
    }
  });

  it("enforces maximum 128 character password length", () => {
    const result = SignupInputSchema.safeParse({
      ...validPayload,
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("rejects common/breached passwords", () => {
    const result = SignupInputSchema.safeParse({
      ...validPayload,
      password: "password12345",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(" ");
      expect(msg).toContain("common");
    }
  });

  it("accepts long passphrase without forced symbol classes", () => {
    // NIST SP 800-63B: no forced composition rules
    const result = SignupInputSchema.safeParse({
      ...validPayload,
      password: "mycatsnameisgingerbread", // all lowercase, no digits/symbols
    });
    expect(result.success).toBe(true);
  });

  it("normalizes email addresses to lower case", () => {
    const result = SignupInputSchema.safeParse({
      ...validPayload,
      email: "  USER.NAME@EXAMPLE.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user.name@example.com");
    }
  });
});
