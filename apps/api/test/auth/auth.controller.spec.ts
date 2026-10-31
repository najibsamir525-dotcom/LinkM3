import { describe, it, expect, vi } from "vitest";
import { AuthController } from "../../src/auth/auth.controller.js";
import { AuthService } from "../../src/auth/auth.service.js";
import { GoneException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

describe("AuthController", () => {
  it("rejects direct /auth/signup with GoneException (enforces single signup path via Better Auth)", async () => {
    const mockAuthService = {
      deleteAccount: vi.fn(),
    } as unknown as AuthService;

    const controller = new AuthController(mockAuthService);

    await expect(controller.signup()).rejects.toThrow(GoneException);
    await expect(controller.signup()).rejects.toThrow(
      /Direct \/auth\/signup endpoint is retired/,
    );
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
