/**
 * Real HTTP-Level Anti-IDOR (Insecure Direct Object Reference) Test Suite
 *
 * Boots the full NestJS HTTP server with FastifyAdapter and executes real HTTP
 * calls via `app.inject()` to test cross-user isolation:
 *
 * 1. User A cannot view User B's profile (HTTP 403 Forbidden)
 * 2. User A cannot update User B's profile (HTTP 403 Forbidden)
 * 3. Unauthenticated requests are rejected (HTTP 401 Unauthorized)
 * 4. User A CAN view and update their own profile (HTTP 200 OK)
 * 5. Sensitive data (phone, city) is encrypted at rest via FLE and decrypted on read
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ConfigModule } from "@nestjs/config";
import { ProfileController } from "../../src/profile/profile.controller.js";
import { ProfileService } from "../../src/profile/profile.service.js";
import { DATABASE_TOKEN } from "../../src/database.module.js";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as fs from "node:fs";
import * as path from "node:path";
import { EncryptionService } from "@linkme/domain";

describe("HTTP-Level Anti-IDOR & Zero-Trust Authorization", () => {
  let app: NestFastifyApplication;
  let pg: PGlite;

  const MASTER_KEY_HEX =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const userA = "11111111-1111-4111-a111-111111111111";
  const userB = "22222222-2222-4222-a222-222222222222";

  beforeAll(async () => {
    pg = new PGlite();
    const db = drizzle(pg);

    // Apply real PostgreSQL DDL from 0000_init.sql
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

    // Seed User A and User B in real PostgreSQL tables
    await pg.exec(`
      INSERT INTO users (id, email, age_confirmed, age_confirmed_at, age_policy_version, role, status)
      VALUES ('${userA}', 'usera@linkme.cv', true, NOW(), 'v1.0', 'USER', 'ACTIVE');

      INSERT INTO users (id, email, age_confirmed, age_confirmed_at, age_policy_version, role, status)
      VALUES ('${userB}', 'userb@linkme.cv', true, NOW(), 'v1.0', 'USER', 'ACTIVE');
    `);

    // Encrypt sensitive fields for initial profiles
    const phoneA = EncryptionService.encrypt("+961-70-111111", MASTER_KEY_HEX);
    const cityA = EncryptionService.encrypt("Beirut", MASTER_KEY_HEX);

    const phoneB = EncryptionService.encrypt("+961-70-222222", MASTER_KEY_HEX);
    const cityB = EncryptionService.encrypt("Byblos", MASTER_KEY_HEX);

    await pg.exec(`
      INSERT INTO profiles (id, user_id, full_name, phone_encrypted, city_encrypted, links)
      VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '${userA}', 'User A Name', '${phoneA}', '${cityA}', '[]');

      INSERT INTO profiles (id, user_id, full_name, phone_encrypted, city_encrypted, links)
      VALUES ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '${userB}', 'User B Name', '${phoneB}', '${cityB}', '[]');
    `);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ ENCRYPTION_MASTER_KEY: MASTER_KEY_HEX })],
        }),
      ],
      controllers: [ProfileController],
      providers: [
        ProfileService,
        {
          provide: DATABASE_TOKEN,
          useValue: db,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix("api");
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await pg.close();
  });

  describe("Cross-User Profile Access Restrictions (IDOR Prevention)", () => {
    it("rejects unauthenticated GET /api/profile/:userId with 401 Unauthorized", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/profile/${userA}`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toMatch(/Authentication.*required/i);
    });

    it("User A attempting to GET User B's profile receives 403 Forbidden", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/profile/${userB}`,
        headers: {
          "x-user-id": userA, // Authenticated as User A
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toMatch(/only access your own profile/i);
    });

    it("User A attempting to PUT User B's profile receives 403 Forbidden", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/profile/${userB}`,
        headers: {
          "x-user-id": userA, // Authenticated as User A
          "content-type": "application/json",
        },
        payload: {
          fullName: "Hacked by User A",
          phone: "+961-70-000000",
          city: "AttackerCity",
          links: [],
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toMatch(/only update your own profile/i);
    });
  });

  describe("Authorized Access & FLE Decryption", () => {
    it("User A accessing their own profile receives 200 OK with decrypted FLE fields", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/profile/${userA}`,
        headers: {
          authorization: `Bearer ${userA}`, // Bearer token format
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.fullName).toBe("User A Name");
      expect(body.phone).toBe("+961-70-111111"); // Plaintext decrypted
      expect(body.city).toBe("Beirut"); // Plaintext decrypted
    });

    it("User A updating their own profile succeeds with 200 OK and stores ciphertext at rest", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/profile/${userA}`,
        headers: {
          authorization: `Bearer ${userA}`,
          "content-type": "application/json",
        },
        payload: {
          fullName: "User A Updated",
          headline: "Principal Systems Architect",
          phone: "+961-71-333333",
          city: "Hamra, Beirut",
          links: [{ label: "Portfolio", url: "https://linkme.cv/usera" }],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.fullName).toBe("User A Updated");
      expect(body.headline).toBe("Principal Systems Architect");
      expect(body.phone).toBe("+961-71-333333");
      expect(body.city).toBe("Hamra, Beirut");

      // Verify that in PostgreSQL database at rest, phone and city are FLE CIPHERTEXT (v1:...)
      const dbRow = await pg.query<{
        phone_encrypted: string;
        city_encrypted: string;
      }>(
        `SELECT phone_encrypted, city_encrypted FROM profiles WHERE user_id = '${userA}'`,
      );

      expect(dbRow.rows[0]?.phone_encrypted).toMatch(
        /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/,
      );
      expect(dbRow.rows[0]?.city_encrypted).toMatch(
        /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/,
      );
      expect(dbRow.rows[0]?.phone_encrypted).not.toContain("+961-71-333333");
    });
  });
});
