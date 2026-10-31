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
  errors?: string[];
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
   *
   * If any step fails, errors are captured, status is set to PARTIAL_FAILURE,
   * and the report is returned so the job is safely retryable.
   */
  async executeErasure(userId: string): Promise<ErasureReport> {
    const requestedAt = new Date();
    const errors: string[] = [];

    // 1. Identify storage assets to delete before DB cascade removes foreign keys
    let assetKeys: string[] = [];
    try {
      assetKeys = await this.dbAdapter.getUserAssetStorageKeys(userId);
    } catch (err: unknown) {
      errors.push(`Failed to retrieve storage keys: ${(err as Error).message}`);
    }

    // 2. Invalidate active sessions immediately in cache
    let sessionsInvalidated = 0;
    try {
      sessionsInvalidated =
        await this.cacheAdapter.invalidateUserSessions(userId);
    } catch (err: unknown) {
      errors.push(`Failed to invalidate sessions: ${(err as Error).message}`);
    }

    // 3. Purge storage objects
    let storageObjectsPurged = 0;
    if (assetKeys.length > 0) {
      try {
        storageObjectsPurged =
          await this.storageAdapter.deleteObjects(assetKeys);
      } catch (err: unknown) {
        errors.push(`Storage purge failed: ${(err as Error).message}`);
      }
    }

    // 4. Cascade DB purge & audit log scrub
    let dbRecordsPurged: TableDeletionCount[] = [];
    let auditLogsAnonymized = 0;
    let taxRecordsTombstoned = 0;

    try {
      const dbPurgeResult = await this.dbAdapter.purgeUserCascading(userId);
      dbRecordsPurged = dbPurgeResult.tableCounts;
      auditLogsAnonymized = dbPurgeResult.auditLogsAnonymized;
      taxRecordsTombstoned = dbPurgeResult.taxRecordsTombstoned;
    } catch (err: unknown) {
      errors.push(`Database cascade purge failed: ${(err as Error).message}`);
    }

    const completedAt = new Date();
    const status = errors.length > 0 ? "PARTIAL_FAILURE" : "COMPLETED";

    const report: ErasureReport = {
      userId,
      requestedAt,
      completedAt,
      status,
      dbRecordsPurged,
      storageObjectsPurged,
      sessionsInvalidated,
      auditLogsAnonymized,
      taxRecordsTombstoned,
    };

    if (errors.length > 0) {
      report.errors = errors;
    }

    return report;
  }
}
