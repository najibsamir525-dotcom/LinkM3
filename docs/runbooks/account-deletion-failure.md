# Runbook: Account Deletion Failure (GDPR Article 17 Remediation)

**Document Version:** 1.0.0  
**Classification:** Privacy Operations & Compliance  
**Severity:** P2 — Regulatory Compliance Threat  
**Trigger:** Healthchecks.io / BullMQ alert indicating an account deletion job failed or timed out during cascading purge.

---

## 1. Compliance Background

Under GDPR Article 17 and Lebanese Law 81/2018, once a user requests account erasure (and any grace period expires), the platform is legally obligated to execute complete cascading erasure across databases, storage objects, and session caches without undue delay.

If an automated erasure job fails (e.g. S3 network failure during object deletion or database lock timeout), this runbook details how to manually verify, retry, and confirm full erasure.

---

## 2. Triage & Investigation

1. **Locate Failed Deletion Request:**

   ```bash
   docker compose -f /opt/linkme/docker-compose.prod.yml exec postgres psql -U linkme_user -d linkme_db -c "
   SELECT id, user_id, requested_at, status, notes
   FROM data_requests
   WHERE type = 'erasure' AND status IN ('pending', 'failed')
   ORDER BY requested_at ASC;
   "
   ```

2. **Check Worker Logs for Specific Error:**
   ```bash
   docker compose -f /opt/linkme/docker-compose.prod.yml logs --tail 200 worker | grep -i "erasure"
   ```
   - Common causes:
     - Cloudflare R2 / S3 network timeout or throttling during asset batch deletion.
     - Foreign key deadlock if user has active background export jobs.

---

## 3. Manual Remediation & Re-Execution

Execute the standalone account erasure command with explicit logging:

```bash
cd /opt/linkme
node scripts/execute-user-erasure.mjs --user-id "<TARGET_USER_UUID>"
```

The script:

1. Invalidates all cached sessions in Valkey: `sessions:user:<id>`.
2. Fetches all remaining `storage_key` entries from `media_assets` for the user.
3. Issues S3 `DeleteObjectsCommand` to Cloudflare R2 bucket.
4. Executes cascading SQL delete: `DELETE FROM users WHERE id = '<TARGET_USER_UUID>'`.
5. Anonymizes audit logs: sets `actor_id = NULL` and scrubs metadata.
6. Updates `data_requests` record: `status = 'completed'`, `completed_at = NOW()`.
7. Outputs the cryptographic `ErasureReport` to stdout.

---

## 4. Verification Checklist

Execute verification queries confirming zero residual user records exist:

```bash
docker compose -f /opt/linkme/docker-compose.prod.yml exec postgres psql -U linkme_user -d linkme_db -c "
SELECT 'users' AS table_name, count(*) FROM users WHERE id = '<TARGET_USER_UUID>'
UNION ALL
SELECT 'profiles', count(*) FROM profiles WHERE user_id = '<TARGET_USER_UUID>'
UNION ALL
SELECT 'resumes', count(*) FROM resumes WHERE user_id = '<TARGET_USER_UUID>'
UNION ALL
SELECT 'media_assets', count(*) FROM media_assets WHERE user_id = '<TARGET_USER_UUID>'
UNION ALL
SELECT 'sessions', count(*) FROM sessions WHERE user_id = '<TARGET_USER_UUID>';
"
```

_Expected result: 0 for all queried tables._
