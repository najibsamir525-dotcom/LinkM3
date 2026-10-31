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

  it("handles partial failure gracefully when storage purge throws, returning PARTIAL_FAILURE", async () => {
    const mockDbAdapter: DatabasePurgeAdapter = {
      getUserAssetStorageKeys: vi.fn().mockResolvedValue(["assets/avatar.jpg"]),
      purgeUserCascading: vi.fn().mockResolvedValue({
        tableCounts: [{ tableName: "users", rowsDeleted: 1 }],
        auditLogsAnonymized: 1,
        taxRecordsTombstoned: 0,
      }),
    };

    const mockStorageAdapter: StoragePurgeAdapter = {
      deleteObjects: vi
        .fn()
        .mockRejectedValue(new Error("S3 503 Service Unavailable")),
    };

    const mockCacheAdapter: CacheSessionPurgeAdapter = {
      invalidateUserSessions: vi.fn().mockResolvedValue(1),
    };

    const orchestrator = new AccountErasureOrchestrator(
      mockDbAdapter,
      mockStorageAdapter,
      mockCacheAdapter,
    );

    const report = await orchestrator.executeErasure("usr_partial_fail");

    expect(report.status).toBe("PARTIAL_FAILURE");
    expect(report.errors).toBeDefined();
    expect(report.errors![0]).toContain(
      "Storage purge failed: S3 503 Service Unavailable",
    );
    expect(report.sessionsInvalidated).toBe(1);
    expect(report.dbRecordsPurged).toHaveLength(1);
  });

  it("handles partial failure when database cascade throws, capturing error in report", async () => {
    const mockDbAdapter: DatabasePurgeAdapter = {
      getUserAssetStorageKeys: vi.fn().mockResolvedValue([]),
      purgeUserCascading: vi
        .fn()
        .mockRejectedValue(new Error("Database deadlock")),
    };

    const mockStorageAdapter: StoragePurgeAdapter = {
      deleteObjects: vi.fn().mockResolvedValue(0),
    };

    const mockCacheAdapter: CacheSessionPurgeAdapter = {
      invalidateUserSessions: vi.fn().mockResolvedValue(2),
    };

    const orchestrator = new AccountErasureOrchestrator(
      mockDbAdapter,
      mockStorageAdapter,
      mockCacheAdapter,
    );

    const report = await orchestrator.executeErasure("usr_db_fail");

    expect(report.status).toBe("PARTIAL_FAILURE");
    expect(report.errors).toBeDefined();
    expect(report.errors![0]).toContain(
      "Database cascade purge failed: Database deadlock",
    );
    expect(report.sessionsInvalidated).toBe(2);
  });

  it("handles partial failure when session cache invalidation throws, capturing error in report", async () => {
    const mockDbAdapter: DatabasePurgeAdapter = {
      getUserAssetStorageKeys: vi
        .fn()
        .mockRejectedValue(new Error("Connection reset")),
      purgeUserCascading: vi.fn().mockResolvedValue({
        tableCounts: [{ tableName: "users", rowsDeleted: 1 }],
        auditLogsAnonymized: 0,
        taxRecordsTombstoned: 0,
      }),
    };

    const mockStorageAdapter: StoragePurgeAdapter = {
      deleteObjects: vi.fn().mockResolvedValue(0),
    };

    const mockCacheAdapter: CacheSessionPurgeAdapter = {
      invalidateUserSessions: vi
        .fn()
        .mockRejectedValue(new Error("Valkey timeout")),
    };

    const orchestrator = new AccountErasureOrchestrator(
      mockDbAdapter,
      mockStorageAdapter,
      mockCacheAdapter,
    );

    const report = await orchestrator.executeErasure("usr_multi_fail");

    expect(report.status).toBe("PARTIAL_FAILURE");
    expect(report.errors).toHaveLength(2);
  });
});
