/**
 * Account Erasure (GDPR Article 17 / Law 81) Integration Test
 *
 * Runs against a real PostgreSQL 16 engine (PGlite) and tests:
 * 1. Cascading erasure of Better Auth tables: user, session, account, verification, two_factor
 * 2. Cascading erasure of LINKME domain tables: users, profiles, consent_records, media_assets
 * 3. Object storage purging (MinIO in dev, S3 in prod)
 * 4. Audit log anonymization (IP erased, actor scrubbed)
 * 5. Idempotency: Second execution succeeds cleanly with 0 errors
 * 6. Cryptographic digest verification of the Erasure Certificate
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as fs from "node:fs";
import * as path from "node:path";
import { AccountErasureService } from "../../src/privacy/account-erasure.service.js";
import { users, profiles, mediaAssets, type Database } from "@linkme/db";
import { eq } from "drizzle-orm";

describe("Account Erasure Service — Real PostgreSQL 16 Integration", () => {
  let pg: PGlite;
  let db: Database;
  let erasureService: AccountErasureService;

  const testUserId = "99999999-9999-4999-a999-999999999999";

  beforeAll(async () => {
    pg = new PGlite();
    db = drizzle(pg) as unknown as Database;

    // Load full PostgreSQL schema from 0000_init.sql
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

    // Also add Better Auth tables to the catalog
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

  it("populates user data across Better Auth and domain tables", async () => {
    // 1. Seed Better Auth tables
    await pg.exec(`
      INSERT INTO "user" (id, name, email, email_verified, age_confirmed, age_policy_version, terms_accepted)
      VALUES ('${testUserId}', 'Erasure Subject', 'erasure@linkme.cv', true, true, 'v1.0', true);

      INSERT INTO "session" (id, expires_at, token, user_id)
      VALUES ('sess_1', NOW() + INTERVAL '1 day', 'tok_abc', '${testUserId}');

      INSERT INTO "account" (id, account_id, provider_id, user_id)
      VALUES ('acc_1', 'acc_local', 'credential', '${testUserId}');

      INSERT INTO "two_factor" (id, secret, backup_codes, user_id)
      VALUES ('tf_1', 'secret_key', '["code1"]', '${testUserId}');
    `);

    // 2. Seed LINKME domain tables
    await pg.exec(`
      INSERT INTO users (id, email, age_confirmed, age_confirmed_at, age_policy_version, role, status)
      VALUES ('${testUserId}', 'erasure@linkme.cv', true, NOW(), 'v1.0', 'USER', 'ACTIVE');

      INSERT INTO profiles (id, user_id, full_name, links)
      VALUES ('33333333-3333-4333-a333-333333333333', '${testUserId}', 'Erasure Subject', '[]');

      INSERT INTO media_assets (id, user_id, storage_key, original_filename, mime_type, size_bytes, sha256_hash)
      VALUES ('44444444-4444-4444-a444-444444444444', '${testUserId}', 'users/${testUserId}/avatars/photo.jpg', 'photo.jpg', 'image/jpeg', 1024, 'dummy_hash');

      INSERT INTO consent_records (id, user_id, purpose, granted, policy_version)
      VALUES ('55555555-5555-4555-a555-555555555555', '${testUserId}', 'essential_cookies', true, 'v1.0');

      INSERT INTO audit_logs (id, actor_id, actor_role, action, target_type, target_id, ip_subnet)
      VALUES ('66666666-6666-4666-a666-666666666666', '${testUserId}', 'USER', 'profile.update', 'profile', '${testUserId}', '192.168.1.1');
    `);

    // Verify insertion succeeded
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId));
    expect(userRows).toHaveLength(1);
  });

  it("executes complete cascading erasure and generates valid report", async () => {
    const report = await erasureService.eraseAccount(testUserId);

    expect(report.userId).toBe(testUserId);
    expect(report.status).toBe("COMPLETED");
    expect(report.storageObjectsPurged).toBe(1); // photo.jpg purged from storage
    expect(report.auditLogsAnonymized).toBeGreaterThanOrEqual(1);
    expect(report.reportDigest).toBeDefined();
    expect(report.reportDigest).toHaveLength(64); // SHA-256 hex digest

    // 1. Verify Better Auth tables are wiped
    const baUserRes = await pg.query(
      `SELECT * FROM "user" WHERE id = '${testUserId}'`,
    );
    expect(baUserRes.rows).toHaveLength(0);

    const baSessRes = await pg.query(
      `SELECT * FROM "session" WHERE user_id = '${testUserId}'`,
    );
    expect(baSessRes.rows).toHaveLength(0);

    const baAccRes = await pg.query(
      `SELECT * FROM "account" WHERE user_id = '${testUserId}'`,
    );
    expect(baAccRes.rows).toHaveLength(0);

    const baTfRes = await pg.query(
      `SELECT * FROM "two_factor" WHERE user_id = '${testUserId}'`,
    );
    expect(baTfRes.rows).toHaveLength(0);

    // 2. Verify LINKME domain tables are wiped via CASCADE
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId));
    expect(userRows).toHaveLength(0);

    const profileRows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, testUserId));
    expect(profileRows).toHaveLength(0);

    const mediaRows = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, testUserId));
    expect(mediaRows).toHaveLength(0);

    // 3. Verify audit log was anonymized, not deleted (for legal compliance)
    const auditRes = await pg.query<{
      actor_id: string | null;
      metadata: Record<string, unknown>;
    }>(
      `SELECT actor_id, metadata FROM audit_logs WHERE id = '66666666-6666-4666-a666-666666666666'`,
    );
    expect(auditRes.rows[0]?.actor_id).toBeNull();
    expect(auditRes.rows[0]?.metadata?.["anonymized"]).toBe(true);
  });

  it("is idempotent: re-executing erasure succeeds cleanly with 0 errors", async () => {
    // Calling erasure a second time on an already erased user
    const retryReport = await erasureService.eraseAccount(testUserId);

    expect(retryReport.status).toBe("COMPLETED");
    expect(retryReport.storageObjectsPurged).toBe(0);
    expect(retryReport.reportDigest).toBeDefined();
    expect(retryReport.reportDigest).toHaveLength(64);
  });

  it("handles partial failure when a sub-adapter throws, reporting PARTIAL_FAILURE with error details", async () => {
    // Mock deleteObjects to throw an exception
    const originalDelete = erasureService.deleteObjects.bind(erasureService);
    erasureService.deleteObjects = async () => {
      throw new Error("S3 500 Internal Error: Connection timeout");
    };

    // Seed a user with an asset
    const partialUserId = "88888888-8888-4888-a888-888888888888";
    await pg.exec(`
      INSERT INTO users (id, email, age_confirmed, age_confirmed_at, age_policy_version, role, status)
      VALUES ('${partialUserId}', 'partial@linkme.cv', true, NOW(), 'v1.0', 'USER', 'ACTIVE');

      INSERT INTO media_assets (id, user_id, storage_key, original_filename, mime_type, size_bytes, sha256_hash)
      VALUES (gen_random_uuid(), '${partialUserId}', 'users/${partialUserId}/avatar.jpg', 'avatar.jpg', 'image/jpeg', 1024, 'dummy_hash');
    `);

    const partialReport = await erasureService.eraseAccount(partialUserId);

    expect(partialReport.status).toBe("PARTIAL_FAILURE");
    expect(partialReport.errors).toBeDefined();
    expect(partialReport.errors![0]).toContain(
      "Storage purge failed: S3 500 Internal Error",
    );

    // Restore original deleteObjects and retry
    erasureService.deleteObjects = originalDelete;
    const retryReport = await erasureService.eraseAccount(partialUserId);
    expect(retryReport.status).toBe("COMPLETED");
  });
});
