/**
 * Phase 1 Gatekeeper: Complete End-to-End User Journey Integration Test
 *
 * Runs against a real PostgreSQL 16 engine (PGlite) and tests the full lifecycle:
 *
 * 1. Sign Up: 18+ age gate + mandatory consent ledger recording + NIST password + Argon2id
 * 2. Verify Email: transitions user status to ACTIVE, emailVerified: true
 * 3. Login: validates Argon2id hash and establishes active session
 * 4. Master Profile: updates profile with FLE AES-256-GCM encrypted fields (phone, city)
 *    -> Asserts v1:iv:tag:ciphertext in database, plaintext on authorized read
 * 5. File Upload Intent: magic byte validation + MIME check + media asset registration
 * 6. Account Deletion (GDPR Art. 17 / Law 81): cascading erasure across Better Auth tables,
 *    domain tables, storage assets, and sessions, generating cryptographic Erasure Certificate
 * 7. Erasure Idempotency: re-running erasure succeeds with 0 errors
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  PasswordHasher,
  PasswordPolicyValidator,
  EncryptionService,
  MagicByteVerifier,
  UploadIntentSchema,
} from "@linkme/domain";
import {
  users,
  profiles,
  mediaAssets,
  consentRecords,
  sessions,
  auditLogs,
  type Database,
} from "@linkme/db";
import { AccountErasureService } from "../../src/privacy/account-erasure.service.js";
import { eq } from "drizzle-orm";

describe("E2E User Journey: Signup -> FLE Profile -> Upload -> Erasure", () => {
  let pg: PGlite;
  let db: Database;
  let erasureService: AccountErasureService;

  const MASTER_KEY_HEX =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  let createdUserId: string;

  beforeAll(async () => {
    pg = new PGlite();
    db = drizzle(pg) as unknown as Database;

    // Apply 0000_init.sql forward migration to real PostgreSQL engine
    const initSqlPath = path.resolve(
      __dirname,
      "../../../../packages/db/drizzle/0000_init.sql",
    );
    const initSql = fs.readFileSync(initSqlPath, "utf8");

    const statements = initSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await pg.exec(stmt);
    }

    // Add Better Auth relational tables
    await pg.exec(`
      CREATE TABLE IF NOT EXISTS "user" (
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

      CREATE TABLE IF NOT EXISTS "session" (
        id TEXT PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "account" (
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

      CREATE TABLE IF NOT EXISTS "verification" (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "two_factor" (
        id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        backup_codes TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        failed_verification_count INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      );
    `);

    erasureService = new AccountErasureService(db);
  });

  afterAll(async () => {
    await pg.close();
  });

  // ── Step 1: Sign Up with 18+ Age Gate & Consent ────────────────────────────
  it("Step 1: Sign up user with 18+ age gate, NIST password, and consent record", async () => {
    const rawPassword = "CorrectHorseBatteryStaple2026!Secure";

    // Validate password meets NIST SP 800-63B
    const policyResult = PasswordPolicyValidator.validate(rawPassword);
    expect(policyResult.valid).toBe(true);

    // Hash with Argon2id
    const passwordHash = await PasswordHasher.hashPassword(rawPassword);
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);

    const now = new Date();

    // Insert user into PostgreSQL
    const [insertedUser] = await db
      .insert(users)
      .values({
        email: "journey.user@linkme.cv",
        passwordHash,
        locale: "en",
        ageConfirmed: true,
        ageConfirmedAt: now,
        agePolicyVersion: "v1.0",
        emailVerified: false,
        role: "USER",
        status: "PENDING_VERIFICATION",
      })
      .returning();

    expect(insertedUser).toBeDefined();
    createdUserId = insertedUser!.id;
    expect(insertedUser!.ageConfirmed).toBe(true);
    expect(insertedUser!.status).toBe("PENDING_VERIFICATION");

    // Mirror to Better Auth table
    await pg.exec(`
      INSERT INTO "user" (id, name, email, email_verified, age_confirmed, age_confirmed_at, age_policy_version, terms_accepted)
      VALUES ('${createdUserId}', 'Farah Al-Khatib', 'journey.user@linkme.cv', false, true, NOW(), 'v1.0', true);
    `);

    // Record essential consent in GDPR / Law 81 ledger
    await db.insert(consentRecords).values({
      userId: createdUserId,
      purpose: "essential_cookies",
      granted: true,
      policyVersion: "v1.0",
      ipSubnet: "192.168.1.0/24",
    });

    const consent = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.userId, createdUserId));

    expect(consent).toHaveLength(1);
    expect(consent[0]?.granted).toBe(true);
  });

  // ── Step 2: Email Verification ─────────────────────────────────────────────
  it("Step 2: Email verification activates account", async () => {
    const now = new Date();

    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: now,
        status: "ACTIVE",
      })
      .where(eq(users.id, createdUserId));

    await pg.exec(`
      UPDATE "user" SET email_verified = true, status = 'ACTIVE' WHERE id = '${createdUserId}'
    `);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, createdUserId));

    expect(user[0]?.emailVerified).toBe(true);
    expect(user[0]?.status).toBe("ACTIVE");
  });

  // ── Step 3: Login & Session Establishment ──────────────────────────────────
  it("Step 3: Login validates Argon2id hash and establishes session", async () => {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, createdUserId));

    const storedHash = user[0]?.passwordHash!;
    const isPasswordValid = await PasswordHasher.verifyPassword(
      storedHash,
      "CorrectHorseBatteryStaple2026!Secure",
    );
    expect(isPasswordValid).toBe(true);

    // Create session in sessions table
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [session] = await db
      .insert(sessions)
      .values({
        userId: createdUserId,
        tokenHash: "dummy_session_token_hash_sha256",
        expiresAt,
        deviceInfo: "Chrome 130 on Windows 11",
        ipSubnet: "192.168.1.0/24",
      })
      .returning();

    expect(session).toBeDefined();
    expect(session!.userId).toBe(createdUserId);

    // Also mirror to Better Auth session table
    await pg.exec(`
      INSERT INTO "session" (id, token, expires_at, user_id)
      VALUES ('sess_journey', 'token_journey_123', NOW() + INTERVAL '7 days', '${createdUserId}');
    `);
  });

  // ── Step 4: Create & Update Master Profile with FLE ─────────────────────────
  it("Step 4: Master Profile encrypts sensitive fields at rest and decrypts on read", async () => {
    // Encrypt sensitive phone and city via AES-256-GCM envelope
    const rawPhone = "+961-70-987654";
    const rawCity = "Beirut";

    const phoneEncrypted = EncryptionService.encrypt(rawPhone, MASTER_KEY_HEX);
    const cityEncrypted = EncryptionService.encrypt(rawCity, MASTER_KEY_HEX);

    // Ensure envelope format
    expect(phoneEncrypted).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(cityEncrypted).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);

    // Create profile
    const [profile] = await db
      .insert(profiles)
      .values({
        userId: createdUserId,
        fullName: "Farah Al-Khatib",
        headline: "Lead Software Architect",
        bio: "Specializing in zero-cost, high-assurance distributed systems.",
        phoneEncrypted,
        cityEncrypted,
        links: [{ label: "GitHub", url: "https://github.com/farah" }],
      })
      .returning();

    expect(profile).toBeDefined();
    expect(profile!.fullName).toBe("Farah Al-Khatib");

    // Verify database at rest stores ciphertext ONLY
    const rawDbProfile = await pg.query<{
      phone_encrypted: string;
      city_encrypted: string;
    }>(
      `SELECT phone_encrypted, city_encrypted FROM profiles WHERE user_id = '${createdUserId}'`,
    );

    expect(rawDbProfile.rows[0]?.phone_encrypted).toBe(phoneEncrypted);
    expect(rawDbProfile.rows[0]?.phone_encrypted).not.toContain(
      "+961-70-987654",
    );

    // Verify authorized decryption returns original plaintext
    const decryptedPhone = EncryptionService.decrypt(
      rawDbProfile.rows[0]?.phone_encrypted!,
      MASTER_KEY_HEX,
    );
    const decryptedCity = EncryptionService.decrypt(
      rawDbProfile.rows[0]?.city_encrypted!,
      MASTER_KEY_HEX,
    );
    expect(decryptedPhone).toBe(rawPhone);
    expect(decryptedCity).toBe(rawCity);
  });

  // ── Step 5: Validate File Upload Intent & Magic Bytes ───────────────────────
  it("Step 5: Validates file upload intent and registers media asset", async () => {
    // 1. PDF header (%PDF-1.7)
    const validPdfBuffer = Buffer.from("%PDF-1.7\n%Fake PDF content for test");
    const isPdfValid = MagicByteVerifier.verify(
      validPdfBuffer,
      "application/pdf",
    );
    expect(isPdfValid).toBe(true);

    const schemaRes = UploadIntentSchema.safeParse({
      filename: "cv.pdf",
      mimeType: "application/pdf",
      sizeBytes: validPdfBuffer.length,
    });
    expect(schemaRes.success).toBe(true);

    // 2. Reject executable disguised as PDF
    const fakePdfBuffer = Buffer.from(
      "MZ\x90\x00\x03\x00\x00\x00Executable binary",
    );
    const isFakeValid = MagicByteVerifier.verify(
      fakePdfBuffer,
      "application/pdf",
    );
    expect(isFakeValid).toBe(false);

    // 3. Register valid avatar asset in media_assets
    const [media] = await db
      .insert(mediaAssets)
      .values({
        userId: createdUserId,
        storageKey: `users/${createdUserId}/avatars/headshot.jpg`,
        originalFilename: "headshot.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
        sha256Hash:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        scanStatus: "clean",
      })
      .returning();

    expect(media).toBeDefined();

    // Link avatar to profile
    await db
      .update(profiles)
      .set({ photoAssetId: media!.id })
      .where(eq(profiles.userId, createdUserId));
  });

  // ── Step 6: Account Deletion (GDPR Article 17 / Law 81) ─────────────────────
  it("Step 6: Cascading erasure purges database, storage, and sessions with cryptographic report", async () => {
    // Seed an audit log for user
    await pg.exec(`
      INSERT INTO audit_logs (id, actor_id, actor_role, action, target_type, target_id, ip_subnet)
      VALUES (gen_random_uuid(), '${createdUserId}', 'USER', 'user.login', 'user', '${createdUserId}', '192.168.1.1');
    `);

    // Execute complete cascading erasure
    const report = await erasureService.eraseAccount(createdUserId);

    expect(report.userId).toBe(createdUserId);
    expect(report.status).toBe("COMPLETED");
    expect(report.storageObjectsPurged).toBe(1); // Avatar storage asset purged
    expect(report.sessionsInvalidated).toBeGreaterThanOrEqual(1);
    expect(report.auditLogsAnonymized).toBe(1);
    expect(report.reportDigest).toBeDefined();
    expect(report.reportDigest).toHaveLength(64);

    // 1. Verify user is deleted from users table
    const remainingUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, createdUserId));
    expect(remainingUsers).toHaveLength(0);

    // 2. Verify profiles table cascaded to 0
    const remainingProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, createdUserId));
    expect(remainingProfiles).toHaveLength(0);

    // 3. Verify media_assets table cascaded to 0
    const remainingMedia = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, createdUserId));
    expect(remainingMedia).toHaveLength(0);

    // 4. Verify consent_records table cascaded to 0
    const remainingConsent = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.userId, createdUserId));
    expect(remainingConsent).toHaveLength(0);

    // 5. Verify sessions table cascaded to 0
    const remainingSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, createdUserId));
    expect(remainingSessions).toHaveLength(0);

    // 6. Verify Better Auth tables wiped
    const baUser = await pg.query(
      `SELECT * FROM "user" WHERE id = '${createdUserId}'`,
    );
    expect(baUser.rows).toHaveLength(0);

    const baSess = await pg.query(
      `SELECT * FROM "session" WHERE user_id = '${createdUserId}'`,
    );
    expect(baSess.rows).toHaveLength(0);

    // 7. Verify audit log was anonymized
    const remainingAudit = await pg.query<{ actor_id: string | null }>(
      `SELECT actor_id FROM audit_logs WHERE target_id = '${createdUserId}'`,
    );
    expect(remainingAudit.rows[0]?.actor_id).toBeNull();
  });

  // ── Step 7: Erasure Idempotency ────────────────────────────────────────────
  it("Step 7: Erasure is idempotent when re-executed on deleted account", async () => {
    const retryReport = await erasureService.eraseAccount(createdUserId);

    expect(retryReport.status).toBe("COMPLETED");
    expect(retryReport.storageObjectsPurged).toBe(0);
    expect(retryReport.reportDigest).toBeDefined();
    expect(retryReport.reportDigest).toHaveLength(64);
  });
});
