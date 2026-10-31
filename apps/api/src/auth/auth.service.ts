/**
 * LINKME API — Auth Service
 *
 * Handles LINKME-specific auth business logic that wraps Better Auth:
 * - Age gate enforcement (18+, mandatory boolean confirmation)
 * - Consent recording at signup
 * - Password policy validation (NIST SP 800-63B)
 * - Account deletion (GDPR Article 17 erasure)
 */

import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import {
  SignupInputSchema,
  PasswordHasher,
  PasswordPolicyValidator,
} from "@linkme/domain";
import {
  users,
  profiles,
  consentRecords,
  type Database,
  type Transaction,
} from "@linkme/db";
import { DATABASE_TOKEN } from "../database.module.js";

export interface SignupResult {
  id: string;
  email: string;
  status: string;
  locale: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    _config: ConfigService,
  ) {}

  /**
   * Register a new user with age gate and consent recording.
   *
   * 1. Validates input against SignupInputSchema (Zod)
   * 2. Checks password against NIST SP 800-63B policy
   * 3. Hashes password with Argon2id
   * 4. Creates user record with age confirmation
   * 5. Records essential consent
   * 6. Returns sanitized result (no password hash)
   */
  async signup(input: unknown): Promise<SignupResult> {
    // 1. Validate input
    const parsed = SignupInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: parsed.error.issues.map(
          (issue: { path: PropertyKey[]; message: string }) => ({
            field: issue.path.map(String).join("."),
            message: issue.message,
          }),
        ),
      });
    }

    const data = parsed.data;

    // 2. Additional password policy check
    const policyResult = PasswordPolicyValidator.validate(data.password);
    if (!policyResult.valid) {
      throw new BadRequestException({
        message: "Password does not meet security requirements",
        errors: policyResult.errors.map((e: string) => ({
          field: "password",
          message: e,
        })),
      });
    }

    // 3. Check for existing user
    const existingUsers = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingUsers.length > 0) {
      // Return generic error to prevent email enumeration
      throw new BadRequestException({
        message:
          "Unable to create account. Please try again or use a different email.",
      });
    }

    // 4. Hash password
    const passwordHash = await PasswordHasher.hashPassword(data.password);

    // 5. Create user in a transaction
    const now = new Date();

    const result = await this.db.transaction(async (tx: Transaction) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: data.email,
          passwordHash,
          locale: data.locale,
          ageConfirmed: true,
          ageConfirmedAt: now,
          agePolicyVersion: data.policyVersion,
          emailVerified: false,
          role: "USER",
          status: "PENDING_VERIFICATION",
        })
        .returning({
          id: users.id,
          email: users.email,
          status: users.status,
          locale: users.locale,
        });

      if (!newUser) {
        throw new Error("Failed to create user record");
      }

      // 6. Record essential consent
      await tx.insert(consentRecords).values({
        userId: newUser.id,
        purpose: "essential_cookies",
        granted: true,
        policyVersion: data.policyVersion,
      });

      // 7. Create empty profile
      await tx.insert(profiles).values({
        userId: newUser.id,
        fullName: "",
        links: [],
      });

      return newUser;
    });

    return result;
  }

  /**
   * Delete user account and cascade all data (GDPR Article 17).
   *
   * PostgreSQL CASCADE foreign keys handle most cleanup.
   * S3 object deletion is handled separately by a background worker.
   */
  async deleteAccount(userId: string): Promise<void> {
    // Mark as pending deletion first (7-day grace period)
    await this.db
      .update(users)
      .set({
        status: "PENDING_DELETION",
        deletedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Get user by ID (for session resolution).
   */
  async getUserById(userId: string): Promise<{
    id: string;
    email: string;
    role: string;
    status: string;
  } | null> {
    const result = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result[0] ?? null;
  }
}
