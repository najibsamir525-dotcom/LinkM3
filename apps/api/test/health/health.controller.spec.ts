import { describe, it, expect, vi } from "vitest";
import { HealthController } from "../../src/health/health.controller.js";
import type { Database } from "@linkme/db";

describe("HealthController", () => {
  it("getLive returns status ok and an ISO timestamp", () => {
    const mockDb = {} as Database;
    const controller = new HealthController(mockDb);

    const result = controller.getLive();
    expect(result.status).toBe("ok");
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it("getReady returns status ok and database connected when query succeeds", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as Database;

    const controller = new HealthController(mockDb);
    const result = await controller.getReady();

    expect(result.status).toBe("ok");
    expect(result.database).toBe("connected");
  });

  it("getReady returns status degraded when database query fails", async () => {
    const mockDb = {
      execute: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as Database;

    const controller = new HealthController(mockDb);
    const result = await controller.getReady();

    expect(result.status).toBe("degraded");
    expect(result.database).toBe("disconnected");
  });
});
