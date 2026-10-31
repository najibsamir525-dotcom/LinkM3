import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileService } from "../../src/profile/profile.service.js";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { EncryptionService } from "@linkme/domain";
import type { Database } from "@linkme/db";

describe("ProfileService", () => {
  const MASTER_KEY_HEX =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const userA = "11111111-1111-4111-a111-111111111111";
  const userB = "22222222-2222-4222-a222-222222222222";

  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      getOrThrow: vi.fn().mockReturnValue(MASTER_KEY_HEX),
    } as unknown as ConfigService;
  });

  describe("getProfile (Anti-IDOR & FLE Decryption)", () => {
    it("denies access with ForbiddenException when User A requests User B profile", async () => {
      const mockDb = {} as Database;
      const service = new ProfileService(mockDb, configService);

      await expect(service.getProfile(userB, userA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("throws NotFoundException when profile does not exist", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as unknown as Database;

      const service = new ProfileService(mockDb, configService);

      await expect(service.getProfile(userA, userA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("decrypts FLE encrypted fields (phone, city) for authorized owner", async () => {
      const encryptedPhone = EncryptionService.encrypt(
        "+961-70-123456",
        MASTER_KEY_HEX,
      );
      const encryptedCity = EncryptionService.encrypt("Beirut", MASTER_KEY_HEX);

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "prof_1",
                  userId: userA,
                  fullName: "Omar Developer",
                  headline: "Senior Staff Engineer",
                  bio: "Building resilient systems.",
                  photoAssetId: null,
                  phoneEncrypted: encryptedPhone,
                  cityEncrypted: encryptedCity,
                  links: [
                    { label: "GitHub", url: "https://github.com/linkme" },
                  ],
                  createdAt: new Date("2026-01-01"),
                  updatedAt: new Date("2026-01-02"),
                },
              ]),
            }),
          }),
        }),
      } as unknown as Database;

      const service = new ProfileService(mockDb, configService);
      const profile = await service.getProfile(userA, userA);

      expect(profile.fullName).toBe("Omar Developer");
      expect(profile.phone).toBe("+961-70-123456");
      expect(profile.city).toBe("Beirut");
      expect(profile.links).toHaveLength(1);
    });

    it("returns null for phone and city and empty array for links when they are null or missing", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "prof_empty",
                  userId: userA,
                  fullName: "Empty User",
                  headline: null,
                  bio: null,
                  photoAssetId: null,
                  phoneEncrypted: null,
                  cityEncrypted: null,
                  links: null,
                  createdAt: new Date("2026-01-01"),
                  updatedAt: new Date("2026-01-02"),
                },
              ]),
            }),
          }),
        }),
      } as unknown as Database;

      const service = new ProfileService(mockDb, configService);
      const profile = await service.getProfile(userA, userA);

      expect(profile.phone).toBeNull();
      expect(profile.city).toBeNull();
      expect(profile.links).toEqual([]);
    });
  });

  describe("updateProfile (Anti-IDOR & FLE Encryption)", () => {
    it("denies update with ForbiddenException when User A attempts to update User B profile", async () => {
      const mockDb = {} as Database;
      const service = new ProfileService(mockDb, configService);

      await expect(
        service.updateProfile(userB, userA, { fullName: "Hacked" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("encrypts phone, city, and sensitive fields before writing to database", async () => {
      let capturedSetValues: Record<string, unknown> = {};

      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
            capturedSetValues = values;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "prof_1",
                    userId: userA,
                    fullName: "Omar Updated",
                    headline: "Staff Engineer",
                    bio: null,
                    photoAssetId: null,
                    phoneEncrypted: values["phoneEncrypted"],
                    cityEncrypted: values["cityEncrypted"],
                    links: [],
                    createdAt: new Date("2026-01-01"),
                    updatedAt: new Date("2026-01-03"),
                  },
                ]),
              }),
            };
          }),
        }),
      } as unknown as Database;

      const service = new ProfileService(mockDb, configService);

      const updateInput = {
        fullName: "Omar Updated",
        phone: "+961-71-998877",
        city: "Tripoli",
        links: [],
      };

      const result = await service.updateProfile(userA, userA, updateInput);

      expect(result.fullName).toBe("Omar Updated");
      expect(result.phone).toBe("+961-71-998877");
      expect(result.city).toBe("Tripoli");

      // Verify that plaintext was NOT sent in SQL payload
      expect(capturedSetValues["phoneEncrypted"]).not.toBe("+961-71-998877");
      expect(typeof capturedSetValues["phoneEncrypted"]).toBe("string");
      expect(capturedSetValues["cityEncrypted"]).not.toBe("Tripoli");

      // Verify encrypted payload decrypts cleanly to original plaintext
      const decryptedPhone = EncryptionService.decrypt(
        capturedSetValues["phoneEncrypted"] as string,
        MASTER_KEY_HEX,
      );
      expect(decryptedPhone).toBe("+961-71-998877");
    });

    it("encrypts optional sensitiveFields when provided and handles null phone/city", async () => {
      let capturedSetValues: Record<string, unknown> = {};

      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
            capturedSetValues = values;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "prof_sensitive",
                    userId: userA,
                    fullName: "Sensitive User",
                    headline: null,
                    bio: null,
                    photoAssetId: null,
                    phoneEncrypted: null,
                    cityEncrypted: null,
                    links: null,
                    createdAt: new Date("2026-01-01"),
                    updatedAt: new Date("2026-01-03"),
                  },
                ]),
              }),
            };
          }),
        }),
      } as unknown as Database;

      const service = new ProfileService(mockDb, configService);

      const updateInput = {
        fullName: "Sensitive User",
        sensitiveFields: {
          gender: "prefer_not_to_say",
          nationality: "LB",
        },
        links: [],
      };

      const result = await service.updateProfile(userA, userA, updateInput);

      expect(result.phone).toBeNull();
      expect(result.city).toBeNull();
      expect(
        capturedSetValues["optionalSensitiveFieldsEncrypted"],
      ).toBeDefined();
      expect(capturedSetValues["optionalSensitiveFieldsEncrypted"]).toMatch(
        /^v1:/,
      );
    });

    it("throws BadRequestException when update input fails schema validation", async () => {
      const mockDb = {} as Database;
      const service = new ProfileService(mockDb, configService);

      // Invalid input (fullName missing, invalid links structure)
      const invalidInput = {
        fullName: 12345, // invalid type
        links: "not-an-array",
      };

      await expect(
        service.updateProfile(userA, userA, invalidInput),
      ).rejects.toThrowError("Validation failed");
    });

    it("throws NotFoundException when profile to update does not exist in database", async () => {
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]), // Empty array triggers line 143
            }),
          }),
        }),
      } as unknown as Database;

      const service = new ProfileService(mockDb, configService);

      const validInput = {
        fullName: "Valid Name",
        links: [],
      };

      await expect(
        service.updateProfile(userA, userA, validInput),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
