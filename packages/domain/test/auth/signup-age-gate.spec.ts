import { describe, it, expect } from "vitest";
import { SignupInputSchema } from "../../src/auth/signup.schema.js";

describe("UC-01: Age Gate & Signup Domain Logic", () => {
  const validPayload = {
    email: "user@example.com",
    password: "SecurePassword123!",
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
      expect(result.error.issues[0]?.message).toContain(
        "at least 18 years old",
      );
    }
  });

  it("rejects registration if age gate is missing", () => {
    const { ageConfirmed, ...incompletePayload } = validPayload;
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

  it("enforces strong password policy (min 12 chars, upper, lower, digit, symbol)", () => {
    const weakPasswords = [
      "short1!", // too short
      "alllowercase123!", // missing uppercase
      "ALLUPPERCASE123!", // missing lowercase
      "NoDigitsHere!abc", // missing digit
      "NoSpecialChar123a", // missing special symbol
    ];

    for (const pwd of weakPasswords) {
      const result = SignupInputSchema.safeParse({
        ...validPayload,
        password: pwd,
      });
      expect(result.success).toBe(false);
    }
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
