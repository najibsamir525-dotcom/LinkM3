import { describe, it, expect } from "vitest";
import {
  PasswordPolicyValidator,
  COMMON_PASSWORDS,
} from "../../src/auth/password.policy.js";

describe("UC-02: NIST SP 800-63B Password Policy", () => {
  it("accepts a strong 12+ character passphrase", () => {
    const result = PasswordPolicyValidator.validate("mycatsnameisgingerbread");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects passwords shorter than 12 characters", () => {
    const result = PasswordPolicyValidator.validate("short");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("12 characters");
  });

  it("rejects passwords longer than 128 characters", () => {
    const result = PasswordPolicyValidator.validate("a".repeat(129));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("128 characters");
  });

  it("rejects common/breached passwords case-insensitively", () => {
    const result = PasswordPolicyValidator.validate("PASSWORD12345");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("common");
  });

  it("does NOT require uppercase, digits, or symbols (NIST compliance)", () => {
    // All lowercase, no digits, no symbols — should pass if long enough
    const result = PasswordPolicyValidator.validate("alllowercasenothingelse");
    expect(result.valid).toBe(true);
  });

  it("has a populated common password set", () => {
    expect(COMMON_PASSWORDS.size).toBeGreaterThan(20);
    expect(COMMON_PASSWORDS.has("password12345")).toBe(true);
  });
});
