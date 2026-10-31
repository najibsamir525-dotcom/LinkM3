/**
 * Common/breached password list.
 * Based on NIST SP 800-63B guidance: check passwords against a list of
 * commonly-used, expected, or compromised values.
 *
 * This is a curated subset. In production, integrate with the
 * Have I Been Pwned Passwords API (k-anonymity range endpoint)
 * or load the full HIBP SHA-1 hash set for offline checking.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "123456789012",
  "qwertyuiop12",
  "iloveyou1234",
  "admin1234567",
  "letmein12345",
  "welcome12345",
  "monkey1234567",
  "dragon1234567",
  "master1234567",
  "qwerty1234567",
  "login12345678",
  "princess12345",
  "football12345",
  "shadow12345678",
  "sunshine12345",
  "trustno1trust",
  "password12345",
  "password123456",
  "passw0rd12345",
  "abc123456789",
  "changeme12345",
  "administrator",
  "letmein123456",
  "welcome123456",
  "p@ssw0rd12345",
  "qwerty12345678",
  "123456789abc",
  "123456789abcde",
  "111111111111",
  "000000000000",
  "aaaaaaaaaaaa",
  "abcdefghijkl",
  "abcdef123456",
]);

export class PasswordPolicyValidator {
  /**
   * Validates a password per NIST SP 800-63B guidelines:
   * - Minimum 12 characters
   * - Maximum 128 characters
   * - NOT in a common/breached password list (case-insensitive check)
   * - No forced character class requirements (no mandatory uppercase,
   *   lowercase, digit, or symbol requirements per NIST guidance)
   */
  static validate(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push("Password must be at least 12 characters long.");
    }

    if (password.length > 128) {
      errors.push("Password cannot exceed 128 characters.");
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.push(
        "This password is too common or has appeared in a data breach. Please choose a different password.",
      );
    }

    return { valid: errors.length === 0, errors };
  }
}
