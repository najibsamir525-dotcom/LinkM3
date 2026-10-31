import { describe, it, expect, vi } from "vitest";
import { AccountErasureService } from "../../src/privacy/account-erasure.service.js";
import type { Database } from "@linkme/db";

describe("AccountErasureService (Resilience & Error Handling)", () => {
  it("handles empty media assets gracefully without errors", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("Table select error")),
        }),
      }),
    } as unknown as Database;

    const service = new AccountErasureService(mockDb);
    const keys = await service.getUserAssetStorageKeys("usr_123");
    expect(keys).toEqual([]);
  });

  it("handles storage object deletion with empty keys array", async () => {
    const mockDb = {} as Database;
    const service = new AccountErasureService(mockDb);
    const count = await service.deleteObjects([]);
    expect(count).toBe(0);
    const countWithKeys = await service.deleteObjects(["profile/photo.webp"]);
    expect(countWithKeys).toBe(1);
  });

  it("handles database exceptions during payments, users, and sessions deletion gracefully", async () => {
    const mockDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockRejectedValue(
              new Error("DB Connection Lost during payment tombstone"),
            ),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockRejectedValue(new Error("DB Timeout during user delete")),
        }),
      }),
    } as unknown as Database;

    const service = new AccountErasureService(mockDb);

    // Test purgeUserCascading fallback on lines 161 & 176
    const res = await service.purgeUserCascading("usr_fail_123");
    expect(res.taxRecordsTombstoned).toBe(0);
    expect(
      res.tableCounts.find((t) => t.tableName === "users")?.rowsDeleted,
    ).toBe(0);

    // Test invalidateUserSessions fallback on line 209
    const sessionsPurged = await service.invalidateUserSessions("usr_fail_123");
    expect(sessionsPurged).toBe(0);
  });

  it("covers table drop/execute rejection fallback in cascading purge (line 132)", async () => {
    const mockDb = {
      execute: vi.fn().mockRejectedValue(new Error("Table execution failed")),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 0 }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as Database;

    const service = new AccountErasureService(mockDb);
    const res = await service.purgeUserCascading("usr_fail_456");
    expect(res.tableCounts.length).toBeGreaterThan(0);
    // Every table should fall back to 0 deleted rows on execute error
    expect(res.tableCounts[0].rowsDeleted).toBe(0);
  });

  it("includes 30-day backup retention notice and SHA-256 digest in final erasure result", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "usr_123" }]),
        }),
      }),
    } as unknown as Database;

    const service = new AccountErasureService(mockDb);
    const result = await service.eraseAccount("usr_123");

    expect(result.status).toBe("COMPLETED");
    expect(result.reportDigest).toBeDefined();
    expect(result.reportDigest).toHaveLength(64);
    expect(result.backupRetentionNotice).toContain(
      "permanently expire within 30 days",
    );
  });
});
