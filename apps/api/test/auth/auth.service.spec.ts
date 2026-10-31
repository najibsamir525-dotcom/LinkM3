import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../../src/auth/auth.service.js";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { PasswordHasher } from "@linkme/domain";
import type { Database } from "@linkme/db";

describe("AuthService", () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === "AGE_POLICY_VERSION") return "v1.0";
        return null;
      }),
    } as unknown as ConfigService;
  });

  describe("signup", () => {
    it("rejects signup when ageConfirmed is false", async () => {
      const mockDb = {} as Database;
      const service = new AuthService(mockDb, configService);

      const invalidInput = {
        email: "user@example.com",
        password: "ValidSecurePassword2026!",
        ageConfirmed: false, // Invalid
        termsAccepted: true,
      };

      await expect(service.signup(invalidInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects signup when password is shorter than 12 characters (NIST SP 800-63B)", async () => {
      const mockDb = {} as Database;
      const service = new AuthService(mockDb, configService);

      const invalidInput = {
        email: "user@example.com",
        password: "shortpass1", // 10 chars
        ageConfirmed: true,
        termsAccepted: true,
      };

      await expect(service.signup(invalidInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects signup when password is in the common/breached password blocklist", async () => {
      const mockDb = {} as Database;
      const service = new AuthService(mockDb, configService);

      const invalidInput = {
        email: "user@example.com",
        password: "password12345", // Common password
        ageConfirmed: true,
        termsAccepted: true,
      };

      await expect(service.signup(invalidInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects signup with generic message when email already exists (prevents email enumeration)", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "existing_user" }]),
            }),
          }),
        }),
      } as unknown as Database;

      const service = new AuthService(mockDb, configService);

      const input = {
        email: "existing@example.com",
        password: "AValidNonCommonPassword2026",
        ageConfirmed: true,
        termsAccepted: true,
      };

      await expect(service.signup(input)).rejects.toThrow(BadRequestException);
    });

    it("rejects signup when password policy validator check fails after schema parse", async () => {
      const mockDb = {} as Database;
      const service = new AuthService(mockDb, configService);

      // Spy on PasswordPolicyValidator.validate to trigger line 72-74
      const validateSpy = vi.spyOn(
        await import("@linkme/domain"),
        "PasswordPolicyValidator",
        "get",
      );

      const realDomain = await import("@linkme/domain");
      const realValidate = realDomain.PasswordPolicyValidator.validate;

      let callCount = 0;
      vi.spyOn(
        realDomain.PasswordPolicyValidator,
        "validate",
      ).mockImplementation((pwd: string) => {
        callCount++;
        // First call in safeParse returns valid
        if (callCount === 1) return { valid: true, errors: [] };
        // Second call in service triggers line 72-74
        return {
          valid: false,
          errors: ["Custom security policy violation"],
        };
      });

      const input = {
        email: "user-policy@example.com",
        password: "ValidPassphrase2026!Secure",
        ageConfirmed: true,
        termsAccepted: true,
      };

      await expect(service.signup(input)).rejects.toThrow(BadRequestException);
      vi.restoreAllMocks();
    });

    it("throws error when user record insertion fails inside transaction", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        transaction: vi.fn().mockImplementation(async (callback) => {
          const mockTx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]), // Empty array triggers line 124
              }),
            }),
          };
          return callback(mockTx);
        }),
      } as unknown as Database;

      const service = new AuthService(mockDb, configService);

      const input = {
        email: "fail-create@example.com",
        password: "MySuperSecretValidPassword2026",
        ageConfirmed: true,
        termsAccepted: true,
      };

      await expect(service.signup(input)).rejects.toThrowError(
        "Failed to create user record",
      );
    });

    it("creates user record with Argon2id hash, age confirmation, and consent record", async () => {
      const insertedRows: Record<string, unknown>[] = [];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No existing user
            }),
          }),
        }),
        transaction: vi.fn().mockImplementation(async (callback) => {
          const mockTx = {
            insert: vi.fn().mockReturnValue({
              values: vi
                .fn()
                .mockImplementation((values: Record<string, unknown>) => {
                  insertedRows.push(values);
                  return {
                    returning: vi.fn().mockResolvedValue([
                      {
                        id: "00000000-0000-4000-8000-000000000001",
                        email: "newuser@example.com",
                        status: "PENDING_VERIFICATION",
                        locale: "en",
                      },
                    ]),
                  };
                }),
            }),
          };
          return callback(mockTx);
        }),
      } as unknown as Database;

      const service = new AuthService(mockDb, configService);

      const input = {
        email: "NewUser@Example.com",
        password: "MySuperSecretValidPassword2026",
        ageConfirmed: true,
        termsAccepted: true,
        locale: "en",
      };

      const result = await service.signup(input);

      expect(result.email).toBe("newuser@example.com");
      expect(result.status).toBe("PENDING_VERIFICATION");

      // Verify users table was the first inserted row
      const userRow = insertedRows[0] as Record<string, unknown>;
      expect(userRow).toBeDefined();

      // Verify Argon2id password hash was stored
      const storedHash = userRow["passwordHash"] as string;
      expect(storedHash).toBeDefined();
      expect(storedHash.startsWith("$argon2id$")).toBe(true);

      // Verify the candidate password matches the generated Argon2id hash
      const isValid = await PasswordHasher.verifyPassword(
        storedHash,
        "MySuperSecretValidPassword2026",
      );
      expect(isValid).toBe(true);

      // Verify consent record was also inserted
      const consentRow = insertedRows[1] as Record<string, unknown>;
      expect(consentRow).toBeDefined();
      expect(consentRow["purpose"]).toBe("essential_cookies");
      expect(consentRow["granted"]).toBe(true);
    });
  });

  describe("deleteAccount", () => {
    it("marks user as PENDING_DELETION with deletedAt timestamp for grace period", async () => {
      let updatedValues: Record<string, unknown> = {};

      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
            updatedValues = values;
            return {
              where: vi.fn().mockResolvedValue({}),
            };
          }),
        }),
      } as unknown as Database;

      const service = new AuthService(mockDb, configService);
      await service.deleteAccount("user_to_delete");

      expect(updatedValues["status"]).toBe("PENDING_DELETION");
      expect(updatedValues["deletedAt"]).toBeInstanceOf(Date);
    });
  });

  describe("getUserById", () => {
    it("returns user details when user exists", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "user_1",
                  email: "test@example.com",
                  role: "USER",
                  status: "ACTIVE",
                },
              ]),
            }),
          }),
        }),
      } as unknown as Database;

      const service = new AuthService(mockDb, configService);
      const user = await service.getUserById("user_1");

      expect(user).not.toBeNull();
      expect(user?.email).toBe("test@example.com");
    });

    it("returns null when user does not exist", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as unknown as Database;

      const service = new AuthService(mockDb, configService);
      const user = await service.getUserById("nonexistent");

      expect(user).toBeNull();
    });
  });
});
