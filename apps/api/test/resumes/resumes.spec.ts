import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { ResumesService } from "../../src/resumes/resumes.service.js";
import { ResumesController } from "../../src/resumes/resumes.controller.js";
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { type Database } from "@linkme/db";

describe("Resumes Service & Autosave Concurrency Control (UC-12, UC-15)", () => {
  let pg: PGlite;
  let db: Database;
  let service: ResumesService;
  let controller: ResumesController;

  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const templateId = "33333333-3333-3333-3333-333333333333";

  beforeEach(async () => {
    pg = new PGlite();
    db = drizzle(pg) as unknown as Database;

    await pg.exec(`
      DO $$ BEGIN
        CREATE TYPE direction_type AS ENUM ('ltr', 'rtl');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE "users" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE
      );

      CREATE TABLE "templates" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(128) NOT NULL
      );

      CREATE TABLE "job_targets" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );

      CREATE TABLE "resumes" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        template_id UUID NOT NULL,
        job_target_id UUID,
        title VARCHAR(255) NOT NULL,
        language VARCHAR(10) DEFAULT 'en' NOT NULL,
        direction direction_type DEFAULT 'ltr' NOT NULL,
        style_settings JSONB DEFAULT '{"fontFamily":"Inter","fontSize":10,"primaryColor":"#111827","lineSpacing":1.4,"margins":20}'::jsonb NOT NULL,
        is_archived BOOLEAN DEFAULT FALSE NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      INSERT INTO "users" (id, email) VALUES
        ('${userA}', 'userA@linkme.cv'),
        ('${userB}', 'userB@linkme.cv');

      INSERT INTO "templates" (id, slug, name) VALUES
        ('${templateId}', 'ats-single-column', 'ATS Single Column');
    `);

    service = new ResumesService(db);
    controller = new ResumesController(service);
  });

  it("creates a new resume at initial version 1", async () => {
    const resume = await service.createResume(userA, {
      templateId,
      title: "Software Engineer CV",
      language: "en",
      direction: "ltr",
    });

    expect(resume.id).toBeDefined();
    expect(resume.userId).toBe(userA);
    expect(resume.title).toBe("Software Engineer CV");
    expect(resume.version).toBe(1);
  });

  it("rejects resume creation with empty title", async () => {
    await expect(
      service.createResume(userA, {
        templateId,
        title: "   ",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("retrieves an existing resume for the owner", async () => {
    const created = await service.createResume(userA, {
      templateId,
      title: "Senior Architect",
    });

    const retrieved = await service.getResume(userA, created.id);
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.title).toBe("Senior Architect");
  });

  it("blocks IDOR: User B cannot retrieve User A resume", async () => {
    const created = await service.createResume(userA, {
      templateId,
      title: "Confidential Resume",
    });

    await expect(service.getResume(userB, created.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("returns 404 when resume does not exist", async () => {
    await expect(
      service.getResume(userA, "99999999-9999-9999-9999-999999999999"),
    ).rejects.toThrow(NotFoundException);
  });

  it("autosaves successfully when expectedVersion matches database version", async () => {
    const created = await service.createResume(userA, {
      templateId,
      title: "Draft CV",
    });
    expect(created.version).toBe(1);

    const saved = await service.autosave(userA, created.id, {
      expectedVersion: 1,
      title: "Draft CV - Updated Headline",
      language: "ar",
      direction: "rtl",
      styleSettings: {
        fontFamily: "Noto Sans Arabic",
        fontSize: 11,
        primaryColor: "#000000",
        lineSpacing: 1.5,
        margins: 25,
      },
    });

    expect(saved.version).toBe(2);
    expect(saved.title).toBe("Draft CV - Updated Headline");
    expect(saved.language).toBe("ar");
    expect(saved.direction).toBe("rtl");
    expect(saved.styleSettings.fontFamily).toBe("Noto Sans Arabic");
  });

  it("rejects with HTTP 409 Conflict when expectedVersion is stale (optimistic lock)", async () => {
    const created = await service.createResume(userA, {
      templateId,
      title: "Original CV",
    });

    // Tab A saves version 1 -> advances to version 2
    await service.autosave(userA, created.id, {
      expectedVersion: 1,
      title: "Tab A edit",
    });

    // Tab B attempts to save with old expectedVersion 1
    try {
      await service.autosave(userA, created.id, {
        expectedVersion: 1,
        title: "Tab B stale edit",
      });
      expect.fail("Should have thrown ConflictException");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      const response = err.getResponse();
      expect(response.statusCode).toBe(409);
      expect(response.error).toBe("Conflict");
      expect(response.serverVersion).toBe(2);
      expect(response.message).toContain("Version conflict");
    }
  });

  it("blocks IDOR: User B cannot autosave User A resume", async () => {
    const created = await service.createResume(userA, {
      templateId,
      title: "User A CV",
    });

    await expect(
      service.autosave(userB, created.id, {
        expectedVersion: 1,
        title: "Tampered by User B",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("controller delegates endpoints to service accurately", async () => {
    const req = { user: { id: userA, email: "userA@linkme.cv" } };
    const created = await controller.create(req as any, {
      templateId,
      title: "Controller Test",
    });
    expect(created.id).toBeDefined();

    const fetched = await controller.findOne(req as any, created.id);
    expect(fetched.title).toBe("Controller Test");

    const autosaved = await controller.autosave(req as any, created.id, {
      expectedVersion: 1,
      title: "Controller Autosave",
    });
    expect(autosaved.version).toBe(2);
  });
});
