/**
 * LINKME API — Resumes Service
 *
 * Resume CRUD and Autosave with optimistic locking concurrency control.
 * Throws HTTP 409 Conflict when client expectedVersion !== database version.
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { resumes, type Database, type ResumeStyleSettings } from "@linkme/db";
import { DATABASE_TOKEN } from "../database.module.js";

export interface CreateResumeDto {
  templateId: string;
  title: string;
  language?: string;
  direction?: "ltr" | "rtl";
  styleSettings?: ResumeStyleSettings;
}

export interface AutosaveResumeDto {
  expectedVersion: number;
  title?: string;
  language?: string;
  direction?: "ltr" | "rtl";
  styleSettings?: ResumeStyleSettings;
}

export interface ResumeResponse {
  id: string;
  userId: string;
  templateId: string;
  title: string;
  language: string;
  direction: "ltr" | "rtl";
  styleSettings: ResumeStyleSettings;
  version: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ResumesService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  /**
   * Create a new resume bound to the authenticated user.
   */
  async createResume(
    userId: string,
    dto: CreateResumeDto,
  ): Promise<ResumeResponse> {
    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException("Resume title is required");
    }

    const [created] = await this.db
      .insert(resumes)
      .values({
        userId,
        templateId: dto.templateId,
        title: dto.title.trim(),
        language: dto.language ?? "en",
        direction: dto.direction ?? "ltr",
        styleSettings: dto.styleSettings ?? {
          fontFamily: "Inter",
          fontSize: 10,
          primaryColor: "#111827",
          lineSpacing: 1.4,
          margins: 20,
        },
        version: 1,
      })
      .returning();

    if (!created) {
      throw new BadRequestException("Failed to create resume");
    }

    return {
      id: created.id,
      userId: created.userId,
      templateId: created.templateId,
      title: created.title,
      language: created.language,
      direction: created.direction as "ltr" | "rtl",
      styleSettings: created.styleSettings,
      version: created.version,
      isArchived: created.isArchived,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Retrieve a resume with strict IDOR ownership checks.
   */
  async getResume(userId: string, resumeId: string): Promise<ResumeResponse> {
    const [found] = await this.db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId));

    if (!found) {
      throw new NotFoundException("Resume not found");
    }

    if (found.userId !== userId) {
      throw new ForbiddenException("Access denied: You do not own this resume");
    }

    return {
      id: found.id,
      userId: found.userId,
      templateId: found.templateId,
      title: found.title,
      language: found.language,
      direction: found.direction as "ltr" | "rtl",
      styleSettings: found.styleSettings,
      version: found.version,
      isArchived: found.isArchived,
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    };
  }

  /**
   * Autosave resume with optimistic concurrency check.
   * If expectedVersion !== found.version, rejects with HTTP 409 Conflict.
   */
  async autosave(
    userId: string,
    resumeId: string,
    dto: AutosaveResumeDto,
  ): Promise<ResumeResponse> {
    const [found] = await this.db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId));

    if (!found) {
      throw new NotFoundException("Resume not found");
    }

    if (found.userId !== userId) {
      throw new ForbiddenException("Access denied: You do not own this resume");
    }

    // Optimistic Concurrency Check
    if (found.version !== dto.expectedVersion) {
      throw new ConflictException({
        statusCode: 409,
        error: "Conflict",
        message: `Version conflict: expected version ${dto.expectedVersion}, but current database version is ${found.version}`,
        serverVersion: found.version,
        updatedAt: found.updatedAt,
      });
    }

    const nextVersion = found.version + 1;
    const updateData: Partial<typeof resumes.$inferInsert> = {
      version: nextVersion,
      updatedAt: new Date(),
    };

    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.direction !== undefined) updateData.direction = dto.direction;
    if (dto.styleSettings !== undefined)
      updateData.styleSettings = dto.styleSettings;

    const [updated] = await this.db
      .update(resumes)
      .set(updateData)
      .where(eq(resumes.id, resumeId))
      .returning();

    if (!updated) {
      throw new NotFoundException("Resume not found");
    }

    return {
      id: updated.id,
      userId: updated.userId,
      templateId: updated.templateId,
      title: updated.title,
      language: updated.language,
      direction: updated.direction as "ltr" | "rtl",
      styleSettings: updated.styleSettings,
      version: updated.version,
      isArchived: updated.isArchived,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
