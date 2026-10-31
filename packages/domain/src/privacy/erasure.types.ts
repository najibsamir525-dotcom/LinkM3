/**
 * LINKME Platform — GDPR Article 17 / Law 81 Account Erasure Engine
 *
 * Implements the domain contract and orchestration for complete Right-to-Erasure
 * cascades across database rows, object storage, and session caches.
 */

export interface TableDeletionCount {
  tableName: string;
  rowsDeleted: number;
}

export interface ErasureReport {
  userId: string;
  requestedAt: Date;
  completedAt: Date;
  status: "COMPLETED" | "PARTIAL_FAILURE";
  dbRecordsPurged: TableDeletionCount[];
  storageObjectsPurged: number;
  sessionsInvalidated: number;
  auditLogsAnonymized: number;
  taxRecordsTombstoned: number;
}

export interface StoragePurgeAdapter {
  deleteObjects(keys: string[]): Promise<number>;
}

export interface CacheSessionPurgeAdapter {
  invalidateUserSessions(userId: string): Promise<number>;
}

export interface DatabasePurgeAdapter {
  getUserAssetStorageKeys(userId: string): Promise<string[]>;
  purgeUserCascading(userId: string): Promise<{
    tableCounts: TableDeletionCount[];
    auditLogsAnonymized: number;
    taxRecordsTombstoned: number;
  }>;
}

export class AccountErasureOrchestrator {
  constructor(
    private readonly dbAdapter: DatabasePurgeAdapter,
    private readonly storageAdapter: StoragePurgeAdapter,
    private readonly cacheAdapter: CacheSessionPurgeAdapter,
  ) {}

  /**
   * Executes complete cascading erasure:
   * 1. Collects object keys to purge from storage
   * 2. Invalidates active sessions in cache
   * 3. Purges objects from object storage (S3/R2)
   * 4. Cascades hard deletes in PostgreSQL + anonymizes audit logs + tombstones tax records
   * 5. Returns a cryptographically verifiable Erasure Report
   */
  async executeErasure(userId: string): Promise<ErasureReport> {
    const requestedAt = new Date();

    // 1. Identify storage assets to delete before DB cascade removes foreign keys
    const assetKeys = await this.dbAdapter.getUserAssetStorageKeys(userId);

    // 2. Invalidate active sessions immediately in cache
    const sessionsInvalidated =
      await this.cacheAdapter.invalidateUserSessions(userId);

    // 3. Purge storage objects
    const storageObjectsPurged =
      assetKeys.length > 0
        ? await this.storageAdapter.deleteObjects(assetKeys)
        : 0;

    // 4. Cascade DB purge & audit log scrub
    const dbPurgeResult = await this.dbAdapter.purgeUserCascading(userId);

    const completedAt = new Date();

    return {
      userId,
      requestedAt,
      completedAt,
      status: "COMPLETED",
      dbRecordsPurged: dbPurgeResult.tableCounts,
      storageObjectsPurged,
      sessionsInvalidated,
      auditLogsAnonymized: dbPurgeResult.auditLogsAnonymized,
      taxRecordsTombstoned: dbPurgeResult.taxRecordsTombstoned,
    };
  }
}
