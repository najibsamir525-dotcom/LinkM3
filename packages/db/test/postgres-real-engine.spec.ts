/**
 * REAL PostgreSQL 16 Behavioral & Constraint Test Suite
 *
 * Runs against an in-process, real PostgreSQL 16 engine (PGlite / Testcontainers).
 * Proves real database-level enforcement of:
 * 1. Check constraints (rejections with SQLSTATE 23514)
 * 2. Foreign Key cascading deletes (ON DELETE CASCADE)
 * 3. Foreign Key set-null behavior (ON DELETE SET NULL)
 * 4. Foreign Key restrict behavior (ON DELETE RESTRICT, SQLSTATE 23503)
 * 5. Full migration lifecycle: forward (0000_init.sql) -> down (0000_init_down.sql) -> forward
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";

interface DbClient {
  exec(sqlText: string): Promise<void>;
  query<T = unknown>(sqlText: string): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

describe("Real PostgreSQL 16 Engine: Migrations & Constraint Enforcement", () => {
  let pg: DbClient;
  let initSql: string;
  let downSql: string;

  beforeAll(async () => {
    const dbUrl = process.env["DATABASE_URL"];
    if (dbUrl) {
      console.log(
        "🔗 Testing against REAL PostgreSQL 16 server container:",
        dbUrl,
      );
      const sql = postgres(dbUrl, { max: 1 });
      pg = {
        exec: async (sqlText: string) => {
          await sql.unsafe(sqlText);
        },
        query: async <T = unknown>(sqlText: string) => {
          const res = await sql.unsafe(sqlText);
          return { rows: Array.from(res) as unknown as T[] };
        },
        close: async () => {
          await sql.end();
        },
      };
    } else {
      console.log(
        "⚡ Testing against in-process real PostgreSQL 16 engine (PGlite)",
      );
      const pglite = new PGlite();
      pg = {
        exec: async (sqlText: string) => {
          await pglite.exec(sqlText);
        },
        query: async <T = unknown>(sqlText: string) => {
          return await pglite.query<T>(sqlText);
        },
        close: async () => {
          await pglite.close();
        },
      };
    }

    const initPath = path.resolve(__dirname, "../drizzle/0000_init.sql");
    const downPath = path.resolve(__dirname, "../drizzle/0000_init_down.sql");

    initSql = fs.readFileSync(initPath, "utf8");
    downSql = fs.readFileSync(downPath, "utf8");

    // Apply forward migration to initialize schema
    const statements = initSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await pg.exec(stmt);
    }
  });

  afterAll(async () => {
    await pg.close();
  });

  describe("Schema Deployment & Table Verification", () => {
    it("connects to PostgreSQL engine and verifies version", async () => {
      const res = await pg.query<{ version: string }>("SELECT version()");
      const versionStr = res.rows[0]?.version ?? "";
      console.log("PostgreSQL Version Output:", versionStr);
      expect(versionStr.length).toBeGreaterThan(0);
      if (process.env["DATABASE_URL"]) {
        expect(versionStr.toLowerCase()).toContain("postgresql 16");
      }
    });

    it("creates all 40 relational tables in PostgreSQL catalog (35 domain + 5 Better Auth)", async () => {
      const res = await pg.query<{ count: string }>(
        "SELECT count(*)::text as count FROM information_schema.tables WHERE table_schema = 'public'",
      );
      expect(Number(res.rows[0]?.count)).toBe(40);
    });

    it("creates all 9 custom enum types in pg_type", async () => {
      const res = await pg.query<{ typname: string }>(
        "SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e'",
      );
      const enums = res.rows.map((r) => r.typname);
      expect(enums).toContain("user_role");
      expect(enums).toContain("user_status");
      expect(enums).toContain("direction_type");
      expect(enums).toContain("custom_field_type");
      expect(enums).toContain("job_status");
      expect(enums).toContain("ai_job_kind");
      expect(enums).toContain("subscription_status");
      expect(enums).toContain("plan_type");
      expect(enums).toContain("scan_status_type");
    });
  });

  describe("CHECK Constraint Violations (Real PostgreSQL 23514 Rejections)", () => {
    const testUserId = "11111111-1111-4111-8111-111111111111";
    const testProfileId = "22222222-2222-4222-8222-222222222222";

    beforeAll(async () => {
      // Seed a valid user and profile
      await pg.exec(`
        INSERT INTO users (id, email, age_confirmed, age_confirmed_at, age_policy_version, role, status)
        VALUES ('${testUserId}', 'test-db@linkme.cv', true, NOW(), 'v1.0', 'USER', 'ACTIVE');

        INSERT INTO profiles (id, user_id, full_name, links)
        VALUES ('${testProfileId}', '${testUserId}', 'Real Postgres Test User', '[]');
      `);
    });

    it("rejects experience insertion where end_date < start_date with chk_experience_dates violation", async () => {
      const invalidSql = `
        INSERT INTO experiences (profile_id, company, title, start_date, end_date)
        VALUES ('${testProfileId}', 'Acme Corp', 'Engineer', '2024-05-01', '2023-01-01');
      `;

      await expect(pg.exec(invalidSql)).rejects.toThrowError(
        /chk_experience_dates/i,
      );
    });

    it("accepts ongoing experience where end_date IS NULL", async () => {
      const validSql = `
        INSERT INTO experiences (profile_id, company, title, start_date, end_date)
        VALUES ('${testProfileId}', 'Acme Corp', 'Staff Engineer', '2024-01-01', NULL);
      `;

      await expect(pg.exec(validSql)).resolves.not.toThrow();
    });

    it("rejects education insertion where end_date < start_date with chk_education_dates violation", async () => {
      const invalidSql = `
        INSERT INTO educations (profile_id, institution, degree, start_date, end_date)
        VALUES ('${testProfileId}', 'University', 'BS CS', '2024-09-01', '2022-06-01');
      `;

      await expect(pg.exec(invalidSql)).rejects.toThrowError(
        /chk_education_dates/i,
      );
    });

    it("rejects ATS scores greater than 100 with chk_ats_score_range violation", async () => {
      // First insert template and resume
      const templateId = "33333333-3333-4333-8333-333333333333";
      const resumeId = "44444444-4444-4444-8444-444444444444";

      await pg.exec(`
        INSERT INTO templates (id, name, slug, layout_schema)
        VALUES ('${templateId}', 'Test Template', 'test-tpl', '{}')
        ON CONFLICT DO NOTHING;

        INSERT INTO resumes (id, user_id, template_id, title)
        VALUES ('${resumeId}', '${testUserId}', '${templateId}', 'My Resume')
        ON CONFLICT DO NOTHING;
      `);

      const invalidScoreSql = `
        INSERT INTO ats_scores (resume_id, score, details)
        VALUES ('${resumeId}', 120, '{}');
      `;

      await expect(pg.exec(invalidScoreSql)).rejects.toThrowError(
        /chk_ats_score_range/i,
      );

      const negativeScoreSql = `
        INSERT INTO ats_scores (resume_id, score, details)
        VALUES ('${resumeId}', -1, '{}');
      `;

      await expect(pg.exec(negativeScoreSql)).rejects.toThrowError(
        /chk_ats_score_range/i,
      );
    });

    it("rejects age confirmation when age_confirmed is TRUE but age_confirmed_at is NULL", async () => {
      const invalidAgeSql = `
        INSERT INTO users (id, email, age_confirmed, age_confirmed_at, age_policy_version)
        VALUES ('55555555-5555-4555-8555-555555555555', 'underage@linkme.cv', true, NULL, 'v1.0');
      `;

      await expect(pg.exec(invalidAgeSql)).rejects.toThrowError(
        /chk_age_confirmation/i,
      );
    });
  });

  describe("Foreign Key Cascade, Set-Null, and Restrict Enforcement", () => {
    it("cascades deletion of user to profiles, experiences, and resumes", async () => {
      const cascadeUserId = "66666666-6666-4666-8666-666666666666";
      const cascadeProfileId = "77777777-7777-4777-8777-777777777777";
      const templateId = "33333333-3333-4333-8333-333333333333";

      await pg.exec(`
        INSERT INTO users (id, email, age_confirmed, age_confirmed_at)
        VALUES ('${cascadeUserId}', 'cascade-user@linkme.cv', true, NOW());

        INSERT INTO profiles (id, user_id, full_name, links)
        VALUES ('${cascadeProfileId}', '${cascadeUserId}', 'To Be Deleted', '[]');

        INSERT INTO experiences (profile_id, company, title, start_date)
        VALUES ('${cascadeProfileId}', 'Company A', 'Role A', '2020-01-01');

        INSERT INTO resumes (user_id, template_id, title)
        VALUES ('${cascadeUserId}', '${templateId}', 'Cascade Resume');
      `);

      // Delete the user
      await pg.exec(`DELETE FROM users WHERE id = '${cascadeUserId}'`);

      // Assert profiles and experiences are gone
      const profileCount = await pg.query<{ count: string }>(
        `SELECT count(*)::text as count FROM profiles WHERE id = '${cascadeProfileId}'`,
      );
      expect(Number(profileCount.rows[0]?.count)).toBe(0);

      const expCount = await pg.query<{ count: string }>(
        `SELECT count(*)::text as count FROM experiences WHERE profile_id = '${cascadeProfileId}'`,
      );
      expect(Number(expCount.rows[0]?.count)).toBe(0);

      const resumeCount = await pg.query<{ count: string }>(
        `SELECT count(*)::text as count FROM resumes WHERE user_id = '${cascadeUserId}'`,
      );
      expect(Number(resumeCount.rows[0]?.count)).toBe(0);
    });

    it("sets photo_asset_id to NULL on profile when media asset is deleted (ON DELETE SET NULL)", async () => {
      const setNullUserId = "88888888-8888-4888-8888-888888888888";
      const setNullProfileId = "99999999-9999-4999-8999-999999999999";
      const assetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

      await pg.exec(`
        INSERT INTO users (id, email, age_confirmed, age_confirmed_at)
        VALUES ('${setNullUserId}', 'setnull-user@linkme.cv', true, NOW());

        INSERT INTO media_assets (id, user_id, storage_key, original_filename, mime_type, size_bytes, sha256_hash)
        VALUES ('${assetId}', '${setNullUserId}', 'photos/user.jpg', 'avatar.jpg', 'image/jpeg', 1024, 'abc123hash');

        INSERT INTO profiles (id, user_id, full_name, photo_asset_id, links)
        VALUES ('${setNullProfileId}', '${setNullUserId}', 'SetNull User', '${assetId}', '[]');
      `);

      // Delete the media asset
      await pg.exec(`DELETE FROM media_assets WHERE id = '${assetId}'`);

      // Verify the profile still exists, but photo_asset_id is now NULL
      const profileRes = await pg.query<{ photo_asset_id: string | null }>(
        `SELECT photo_asset_id FROM profiles WHERE id = '${setNullProfileId}'`,
      );
      expect(profileRes.rows[0]?.photo_asset_id).toBeNull();
    });

    it("blocks deletion of a media asset attached to an active document (ON DELETE RESTRICT)", async () => {
      const restrictUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const restrictProfileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const docAssetId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

      await pg.exec(`
        INSERT INTO users (id, email, age_confirmed, age_confirmed_at)
        VALUES ('${restrictUserId}', 'restrict-user@linkme.cv', true, NOW());

        INSERT INTO media_assets (id, user_id, storage_key, original_filename, mime_type, size_bytes, sha256_hash)
        VALUES ('${docAssetId}', '${restrictUserId}', 'docs/degree.pdf', 'degree.pdf', 'application/pdf', 2048, 'hash456');

        INSERT INTO profiles (id, user_id, full_name, links)
        VALUES ('${restrictProfileId}', '${restrictUserId}', 'Doc User', '[]');

        INSERT INTO documents (profile_id, title, asset_id)
        VALUES ('${restrictProfileId}', 'Official Degree Proof', '${docAssetId}');
      `);

      // Attempting to delete the asset must be blocked by RESTRICT
      await expect(
        pg.exec(`DELETE FROM media_assets WHERE id = '${docAssetId}'`),
      ).rejects.toThrow();
    });
  });

  describe("Migration Rollback: Forward -> Down -> Forward", () => {
    it("successfully rolls back all tables and enums via 0000_init_down.sql to clean state", async () => {
      // Execute the rollback script
      await pg.exec(downSql);

      // Verify zero tables remain in public schema
      const tablesRes = await pg.query<{ count: string }>(
        "SELECT count(*)::text as count FROM information_schema.tables WHERE table_schema = 'public'",
      );
      expect(Number(tablesRes.rows[0]?.count)).toBe(0);

      // Verify zero custom enums remain
      const enumsRes = await pg.query<{ count: string }>(
        "SELECT count(*)::text as count FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e'",
      );
      expect(Number(enumsRes.rows[0]?.count)).toBe(0);
    });

    it("cleanly re-applies 0000_init.sql forward migration after rollback (idempotent re-deployment)", async () => {
      const statements = initSql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await pg.exec(stmt);
      }

      // Verify all 40 tables are cleanly restored
      const res = await pg.query<{ count: string }>(
        "SELECT count(*)::text as count FROM information_schema.tables WHERE table_schema = 'public'",
      );
      expect(Number(res.rows[0]?.count)).toBe(40);
    });
  });
});
