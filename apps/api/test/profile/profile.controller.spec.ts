import { describe, it, expect, vi } from "vitest";
import { ProfileController } from "../../src/profile/profile.controller.js";
import { ProfileService } from "../../src/profile/profile.service.js";
import type { FastifyRequest } from "fastify";

describe("ProfileController", () => {
  const mockProfile = {
    id: "prof_1",
    userId: "usr_1",
    fullName: "Omar Developer",
    headline: "Staff Engineer",
    bio: null,
    photoAssetId: null,
    phone: null,
    city: null,
    links: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("getProfile delegates to ProfileService with authenticated userId", async () => {
    const mockProfileService = {
      getProfile: vi.fn().mockResolvedValue(mockProfile),
      updateProfile: vi.fn(),
    } as unknown as ProfileService;

    const controller = new ProfileController(mockProfileService);
    const mockRequest = {
      userId: "usr_1",
    } as unknown as FastifyRequest;

    const result = await controller.getProfile("usr_1", mockRequest);
    expect(mockProfileService.getProfile).toHaveBeenCalledWith(
      "usr_1",
      "usr_1",
    );
    expect(result.fullName).toBe("Omar Developer");
  });

  it("getProfile falls back to param userId when req.userId is undefined", async () => {
    const mockProfileService = {
      getProfile: vi.fn().mockResolvedValue(mockProfile),
      updateProfile: vi.fn(),
    } as unknown as ProfileService;

    const controller = new ProfileController(mockProfileService);
    const mockRequest = {} as FastifyRequest;

    await controller.getProfile("usr_1", mockRequest);
    expect(mockProfileService.getProfile).toHaveBeenCalledWith(
      "usr_1",
      "usr_1",
    );
  });

  it("updateProfile delegates to ProfileService with payload and requesting userId", async () => {
    const mockProfileService = {
      getProfile: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue({
        ...mockProfile,
        fullName: "Omar Updated",
      }),
    } as unknown as ProfileService;

    const controller = new ProfileController(mockProfileService);
    const mockRequest = {
      userId: "usr_1",
    } as unknown as FastifyRequest;

    const body = { fullName: "Omar Updated", links: [] };
    const result = await controller.updateProfile("usr_1", body, mockRequest);

    expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
      "usr_1",
      "usr_1",
      body,
    );
    expect(result.fullName).toBe("Omar Updated");
  });

  it("updateProfile falls back to param userId when req.userId is undefined", async () => {
    const mockProfileService = {
      getProfile: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue({
        ...mockProfile,
        fullName: "Omar Updated",
      }),
    } as unknown as ProfileService;

    const controller = new ProfileController(mockProfileService);
    const mockRequest = {} as FastifyRequest;

    const body = { fullName: "Omar Updated", links: [] };
    await controller.updateProfile("usr_1", body, mockRequest);

    expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
      "usr_1",
      "usr_1",
      body,
    );
  });
});
