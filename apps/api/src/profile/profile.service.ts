/**
 * LINKME API — Profile Service
 *
 * Master Profile CRUD operations with anti-IDOR ownership checks.
 * Sensitive fields (phone, city) are encrypted at rest via FLE.
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import { MasterProfileSchema, EncryptionService } from "@linkme/domain";
import { profiles, type Database } from "@linkme/db";
import { DATABASE_TOKEN } from "../database.module.js";

export interface ProfileResponse {
  id: string;
  userId: string;
  fullName: string;
  headline: string | null;
  bio: string | null;
  photoAssetId: string | null;
  phone: string | null;
  city: string | null;
  links: Array<{ label: string; url: string }>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProfileService {
  private readonly encryptionKey: string;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = this.config.getOrThrow<string>(
      "ENCRYPTION_MASTER_KEY",
    );
  }

  /**
   * Get a user's profile with decrypted sensitive fields.
   * Enforces ownership: only the owning user can read their profile.
   */
  async getProfile(
    userId: string,
    requestingUserId: string,
  ): Promise<ProfileResponse> {
    if (userId !== requestingUserId) {
      throw new ForbiddenException("You can only access your own profile.");
    }

    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    const profile = result[0];
    if (!profile) {
      throw new NotFoundException("Profile not found.");
    }

    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      headline: profile.headline,
      bio: profile.bio,
      photoAssetId: profile.photoAssetId,
      phone: profile.phoneEncrypted
        ? EncryptionService.decrypt(profile.phoneEncrypted, this.encryptionKey)
        : null,
      city: profile.cityEncrypted
        ? EncryptionService.decrypt(profile.cityEncrypted, this.encryptionKey)
        : null,
      links: (profile.links ?? []) as Array<{ label: string; url: string }>,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Update a user's profile. Encrypts sensitive fields before storage.
   * Enforces ownership: only the owning user can update their profile.
   */
  async updateProfile(
    userId: string,
    requestingUserId: string,
    input: unknown,
  ): Promise<ProfileResponse> {
    if (userId !== requestingUserId) {
      throw new ForbiddenException("You can only update your own profile.");
    }

    const parsed = MasterProfileSchema.safeParse({
      ...(input as Record<string, unknown>),
      userId,
    });

    if (!parsed.success) {
      throw new BadRequestException("Validation failed");
    }

    const data = parsed.data;

    // Encrypt sensitive fields
    const phoneEncrypted = data.phone
      ? EncryptionService.encrypt(data.phone, this.encryptionKey)
      : null;
    const cityEncrypted = data.city
      ? EncryptionService.encrypt(data.city, this.encryptionKey)
      : null;
    const sensitiveEncrypted = data.sensitiveFields
      ? EncryptionService.encryptJson(data.sensitiveFields, this.encryptionKey)
      : null;

    const now = new Date();
    const updated = await this.db
      .update(profiles)
      .set({
        fullName: data.fullName,
        headline: data.headline ?? null,
        bio: data.bio ?? null,
        photoAssetId: data.photoAssetId ?? null,
        phoneEncrypted,
        cityEncrypted,
        optionalSensitiveFieldsEncrypted: sensitiveEncrypted,
        links: data.links,
        updatedAt: now,
      })
      .where(eq(profiles.userId, userId))
      .returning();

    const profile = updated[0];
    if (!profile) {
      throw new NotFoundException("Profile not found.");
    }

    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      headline: profile.headline,
      bio: profile.bio,
      photoAssetId: profile.photoAssetId,
      phone: data.phone ?? null,
      city: data.city ?? null,
      links: (profile.links ?? []) as Array<{ label: string; url: string }>,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
