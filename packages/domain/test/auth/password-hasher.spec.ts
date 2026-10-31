import { describe, it, expect } from "vitest";
import {
  PasswordHasher,
  ARGON2_CONFIG,
} from "../../src/auth/password.hasher.js";

describe("UC-02: Argon2id Password Hashing Verification", () => {
  it("conforms to OWASP ASVS Level 2 parameters (64MB memory, 3 iterations, 4 parallelism)", () => {
    expect(ARGON2_CONFIG.memoryCost).toBe(65536);
    expect(ARGON2_CONFIG.timeCost).toBe(3);
    expect(ARGON2_CONFIG.parallelism).toBe(4);
  });

  it("hashes and correctly verifies valid passwords", async () => {
    const rawPassword = "CorrectHorseBatteryStaple123!";
    const hash = await PasswordHasher.hashPassword(rawPassword);

    expect(hash).toMatch(/^\$argon2id\$/);
    const isValid = await PasswordHasher.verifyPassword(hash, rawPassword);
    expect(isValid).toBe(true);
  });

  it("rejects invalid password candidates", async () => {
    const rawPassword = "CorrectHorseBatteryStaple123!";
    const hash = await PasswordHasher.hashPassword(rawPassword);

    const isValid = await PasswordHasher.verifyPassword(
      hash,
      "WrongPassword123!",
    );
    expect(isValid).toBe(false);
  });

  it("handles malformed hashes gracefully without throwing unhandled exceptions", async () => {
    const isValid = await PasswordHasher.verifyPassword(
      "not-a-valid-argon-hash",
      "SomePassword123!",
    );
    expect(isValid).toBe(false);
  });
});
