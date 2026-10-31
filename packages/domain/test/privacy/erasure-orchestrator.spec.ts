import { describe, it, expect, vi } from "vitest";
import {
  AccountErasureOrchestrator,
  type DatabasePurgeAdapter,
  type StoragePurgeAdapter,
  type CacheSessionPurgeAdapter,
} from "../../src/privacy/erasure.types.js";

describe("AccountErasureOrchestrator", () => {
  it("orchestrates complete account erasure across storage, cache, and database", async () => {
    const mockDbAdapter: DatabasePurgeAdapter = {
      getUserAssetStorageKeys: vi
        .fn()
        .mockResolvedValue(["assets/photo1.jpg", "assets/proof1.pdf"]),
      purgeUserCascading: vi.fn().mockResolvedValue({
        tableCounts: [
          { tableName: "profiles", rowsDeleted: 1 },
          { tableName: "experiences", rowsDeleted: 3 },
          { tableName: "media_assets", rowsDeleted: 2 },
          { tableName: "users", rowsDeleted: 1 },
        ],
        auditLogsAnonymized: 5,
        taxRecordsTombstoned: 0,
      }),
    };

    const mockStorageAdapter: StoragePurgeAdapter = {
      deleteObjects: vi.fn().mockResolvedValue(2),
    };

    const mockCacheAdapter: CacheSessionPurgeAdapter = {
      invalidateUserSessions: vi.fn().mockResolvedValue(3),
    };

    const orchestrator = new AccountErasureOrchestrator(
      mockDbAdapter,
      mockStorageAdapter,
      mockCacheAdapter,
    );

    const report = await orchestrator.executeErasure("usr_12345");

    expect(mockDbAdapter.getUserAssetStorageKeys).toHaveBeenCalledWith(
      "usr_12345",
    );
    expect(mockCacheAdapter.invalidateUserSessions).toHaveBeenCalledWith(
      "usr_12345",
    );
    expect(mockStorageAdapter.deleteObjects).toHaveBeenCalledWith([
      "assets/photo1.jpg",
      "assets/proof1.pdf",
    ]);
    expect(mockDbAdapter.purgeUserCascading).toHaveBeenCalledWith("usr_12345");

    expect(report.status).toBe("COMPLETED");
    expect(report.userId).toBe("usr_12345");
    expect(report.storageObjectsPurged).toBe(2);
    expect(report.sessionsInvalidated).toBe(3);
    expect(report.auditLogsAnonymized).toBe(5);
    expect(report.taxRecordsTombstoned).toBe(0);
    expect(report.dbRecordsPurged).toHaveLength(4);
    expect(report.completedAt.getTime()).toBeGreaterThanOrEqual(
      report.requestedAt.getTime(),
    );
  });

  it("handles user with zero storage assets without calling storageAdapter", async () => {
    const mockDbAdapter: DatabasePurgeAdapter = {
      getUserAssetStorageKeys: vi.fn().mockResolvedValue([]),
      purgeUserCascading: vi.fn().mockResolvedValue({
        tableCounts: [{ tableName: "users", rowsDeleted: 1 }],
        auditLogsAnonymized: 1,
        taxRecordsTombstoned: 0,
      }),
    };

    const mockStorageAdapter: StoragePurgeAdapter = {
      deleteObjects: vi.fn().mockResolvedValue(0),
    };

    const mockCacheAdapter: CacheSessionPurgeAdapter = {
      invalidateUserSessions: vi.fn().mockResolvedValue(1),
    };

    const orchestrator = new AccountErasureOrchestrator(
      mockDbAdapter,
      mockStorageAdapter,
      mockCacheAdapter,
    );

    const report = await orchestrator.executeErasure("usr_no_assets");

    expect(mockStorageAdapter.deleteObjects).not.toHaveBeenCalled();
    expect(report.storageObjectsPurged).toBe(0);
    expect(report.status).toBe("COMPLETED");
  });
});
