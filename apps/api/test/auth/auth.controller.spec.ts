import { describe, it, expect, vi } from "vitest";
import { AuthController } from "../../src/auth/auth.controller.js";
import { AuthService } from "../../src/auth/auth.service.js";
import type { FastifyRequest } from "fastify";

describe("AuthController", () => {
  it("signup delegates to AuthService.signup", async () => {
    const mockAuthService = {
      signup: vi.fn().mockResolvedValue({
        id: "usr_123",
        email: "test@example.com",
        status: "PENDING_VERIFICATION",
        locale: "en",
      }),
      deleteAccount: vi.fn(),
    } as unknown as AuthService;

    const controller = new AuthController(mockAuthService);

    const payload = {
      email: "test@example.com",
      password: "MySecurePassword2026",
      ageConfirmed: true,
      termsAccepted: true,
    };

    const result = await controller.signup(payload);
    expect(mockAuthService.signup).toHaveBeenCalledWith(payload);
    expect(result.id).toBe("usr_123");
  });

  it("deleteAccount extracts userId from request and calls AuthService.deleteAccount", async () => {
    const mockAuthService = {
      signup: vi.fn(),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService;

    const controller = new AuthController(mockAuthService);

    const mockRequest = {
      userId: "usr_to_delete",
    } as unknown as FastifyRequest;

    await controller.deleteAccount(mockRequest);
    expect(mockAuthService.deleteAccount).toHaveBeenCalledWith("usr_to_delete");
  });

  it("deleteAccount throws error if userId is not in request", async () => {
    const mockAuthService = {
      signup: vi.fn(),
      deleteAccount: vi.fn(),
    } as unknown as AuthService;

    const controller = new AuthController(mockAuthService);
    const mockRequest = {} as FastifyRequest;

    await expect(controller.deleteAccount(mockRequest)).rejects.toThrow(
      "Authentication required",
    );
  });
});
