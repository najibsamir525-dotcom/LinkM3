/**
 * Better Auth Compliance & Hook Enforcement Test Suite
 *
 * Proves that direct calls to Better Auth endpoints cannot bypass:
 * 1. 18+ Age Gate (must confirm ageConfirmed === true)
 * 2. Terms of Service & Privacy Policy acceptance (termsAccepted === true)
 * 3. NIST SP 800-63B password requirements (< 12 chars rejected, common/breached passwords rejected)
 * 4. Automatic GDPR/Law 81 consent ledger recording on user creation
 * 5. Password verification using Argon2id
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createBetterAuth,
  baSession,
  baAccount,
  baTwoFactor,
  baUser,
} from "../../src/auth/better-auth.config.js";
import { consentRecords, type Database } from "@linkme/db";
import { eq } from "drizzle-orm";

describe("Better Auth Internal Compliance Hooks", () => {
  let pg: PGlite;
  let db: Database;
  let auth: ReturnType<typeof createBetterAuth>;

  beforeAll(async () => {
    pg = new PGlite();
    db = drizzle(pg) as unknown as Database;

    // Initialize required PostgreSQL tables in PGlite
    await pg.exec(`
      CREATE TABLE "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        image TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        age_confirmed_at TIMESTAMP,
        age_policy_version TEXT NOT NULL DEFAULT 'v1.0',
        terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
        role TEXT NOT NULL DEFAULT 'USER',
        status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
        locale TEXT NOT NULL DEFAULT 'en'
      );

      CREATE TABLE "session" (
        id TEXT PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      );

      CREATE TABLE "account" (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at TIMESTAMP,
        refresh_token_expires_at TIMESTAMP,
        scope TEXT,
        password TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE "verification" (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE "two_factor" (
        id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        backup_codes TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        failed_verification_count INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      );

      CREATE TABLE "consent_records" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        purpose VARCHAR(64) NOT NULL,
        granted BOOLEAN NOT NULL,
        policy_version VARCHAR(32) NOT NULL,
        ip_subnet VARCHAR(45),
        user_agent_category VARCHAR(64),
        recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    auth = createBetterAuth(db, {
      baseURL: "http://localhost:3000",
      secret: "test-secret-at-least-32-chars-long-1234567890",
    });
  });

  afterAll(async () => {
    await pg.close();
  });

  describe("18+ Age Gate & Terms Enforcement in databaseHooks", () => {
    it("rejects direct signup when ageConfirmed is missing / false", async () => {
      await expect(
        auth.api.signUpEmail({
          body: {
            name: "Direct Attacker",
            email: "bypass-age@linkme.cv",
            password: "ValidNistPassword2026!",
            ageConfirmed: false,
            termsAccepted: true,
          },
        }),
      ).rejects.toThrowError(/Age gate requirement/i);
    });

    it("rejects direct signup when termsAccepted is missing / false", async () => {
      await expect(
        auth.api.signUpEmail({
          body: {
            name: "No Terms User",
            email: "no-terms@linkme.cv",
            password: "ValidNistPassword2026!",
            ageConfirmed: true,
            termsAccepted: false,
          },
        }),
      ).rejects.toThrowError(/Terms of Service.*acceptance is mandatory/i);
    });
  });

  describe("NIST SP 800-63B Password Policy in Better Auth", () => {
    it("rejects direct signup with password shorter than 12 characters", async () => {
      await expect(
        auth.api.signUpEmail({
          body: {
            name: "Short Pass User",
            email: "short-pass@linkme.cv",
            password: "Short1!",
            ageConfirmed: true,
            termsAccepted: true,
          },
        }),
      ).rejects.toThrowError(/password.*short/i);
    });

    it("rejects direct signup with common/breached password (e.g. password12345)", async () => {
      await expect(
        auth.api.signUpEmail({
          body: {
            name: "Common Pass User",
            email: "common-pass@linkme.cv",
            password: "password12345",
            ageConfirmed: true,
            termsAccepted: true,
          },
        }),
      ).rejects.toThrowError(/too common or has appeared in a data breach/i);
    });
  });

  describe("Compliant Registration & Consent Recording", () => {
    it("successfully creates user with age confirmation, terms, NIST password, and records consent", async () => {
      const response = await auth.api.signUpEmail({
        body: {
          name: "Compliant User",
          email: "compliant@linkme.cv",
          password: "SuperSecureCorrectHorseBatteryStaple2026!",
          ageConfirmed: true,
          termsAccepted: true,
        },
      });

      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.email).toBe("compliant@linkme.cv");
      expect((response.user as Record<string, unknown>).ageConfirmed).toBe(
        true,
      );

      // Verify consent record was automatically persisted
      const consents = await db
        .select()
        .from(consentRecords)
        .where(eq(consentRecords.userId, response.user.id));

      expect(consents.length).toBeGreaterThan(0);
      expect(consents[0]?.purpose).toBe("essential_cookies");
      expect(consents[0]?.granted).toBe(true);
    });
  });

  describe("Argon2id Password Verification on Sign-In (covers password.verify)", () => {
    it("verifies Argon2id hash on signInEmail and establishes session", async () => {
      // Mark email as verified to allow sign-in under requireEmailVerification: true
      await pg.exec(
        `UPDATE "user" SET email_verified = true WHERE email = 'compliant@linkme.cv'`,
      );

      const signInRes = await auth.api.signInEmail({
        body: {
          email: "compliant@linkme.cv",
          password: "SuperSecureCorrectHorseBatteryStaple2026!",
        },
      });

      expect(signInRes).toBeDefined();
      expect(signInRes.user.email).toBe("compliant@linkme.cv");
      expect(signInRes.token).toBeDefined();
    });

    it("rejects invalid password on signInEmail", async () => {
      await expect(
        auth.api.signInEmail({
          body: {
            email: "compliant@linkme.cv",
            password: "WrongPassword2026!",
          },
        }),
      ).rejects.toThrow();
    });

    it("covers table schema reference callbacks (lines 58, 67, 97) and custom options", () => {
      const customAuth = createBetterAuth(db, {
        baseURL: "https://app.linkme.cv",
        secret: "custom-secret-key-at-least-32-characters-long",
      });
      expect(customAuth).toBeDefined();

      const fkSymbol = Object.getOwnPropertySymbols(baSession).find((s) =>
        s.toString().includes("PgInlineForeignKeys"),
      )!;
      const refSession = (baSession as any)[fkSymbol][0].reference();
      const refAccount = (baAccount as any)[fkSymbol][0].reference();
      const refTwoFactor = (baTwoFactor as any)[fkSymbol][0].reference();
      expect(refSession.foreignTable[Symbol.for("drizzle:Name")]).toBe("user");
      expect(refAccount.foreignTable[Symbol.for("drizzle:Name")]).toBe("user");
      expect(refTwoFactor.foreignTable[Symbol.for("drizzle:Name")]).toBe(
        "user",
      );
    });
  });
});
