import { hash, verify, Options } from "@node-rs/argon2";

/**
 * OWASP ASVS Level 2 recommended Argon2id configuration:
 * Memory: 64 MiB (65536 KiB)
 * Iterations: 3
 * Parallelism: 4
 */
export const ARGON2_CONFIG: Options = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export class PasswordHasher {
  static async hashPassword(password: string): Promise<string> {
    return hash(password, ARGON2_CONFIG);
  }

  static async verifyPassword(
    hashedPassword: string,
    candidate: string,
  ): Promise<boolean> {
    try {
      return await verify(hashedPassword, candidate);
    } catch {
      return false;
    }
  }
}
