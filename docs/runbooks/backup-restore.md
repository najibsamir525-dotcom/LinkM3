# Runbook: Backup & Disaster Recovery Restore Drill

**Document Version:** 1.0.0  
**Classification:** Disaster Recovery & Business Continuity  
**Severity:** P1 (Disaster Recovery) / Routine Drill (Monthly)  
**Mandate:** Executed monthly on staging or an isolated test container to verify restore validity.

---

## 1. Backup Topology & Architecture

- **PostgreSQL Backups:** Nightly automated `pg_dump` compressed with gzip, encrypted with GPG (AES-256), and synchronized to Cloudflare R2 bucket `linkme-backups/postgres/`.
- **Pre-Deploy Backups:** Created automatically prior to every production migration.
- **Heartbeat:** Every completed backup sends an HTTP GET ping to Healthchecks.io. If no ping is received within 25 hours, an automated P2 alert fires.

---

## 2. Restoring PostgreSQL from a Backup Snapshot

### Step 2.1: Locate and Download the Target Backup Snapshot

```bash
# List available backups in Cloudflare R2
aws s3 ls s3://linkme-backups/postgres/ \
  --endpoint-url https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com

# Download target backup file
BACKUP_FILE="backup-2026-10-31_020000.sql.gz.gpg"
aws s3 cp s3://linkme-backups/postgres/${BACKUP_FILE} ./ \
  --endpoint-url https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com
```

### Step 2.2: Decrypt the Backup Snapshot

```bash
# Prompt for GPG passphrase (stored securely in administrator secrets manager)
gpg --decrypt --output backup.sql.gz ${BACKUP_FILE}

# Decompress
gunzip backup.sql.gz
```

### Step 2.3: Restore to Target Database

> [!CAUTION]
> This command overwrites the existing database schema and data. Ensure you are executing against the intended target instance.

```bash
# For a drill on staging/local:
docker compose -f docker-compose.prod.yml exec -T postgres psql -U linkme_user -d linkme_db -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO linkme_user;
"

# Stream SQL dump into database
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U linkme_user -d linkme_db
```

---

## 3. Post-Restore Verification Checklist

1. **Verify Table Row Integrity:**

   ```bash
   docker compose -f docker-compose.prod.yml exec postgres psql -U linkme_user -d linkme_db -c "
   SELECT 'users' AS table_name, count(*) FROM users
   UNION ALL
   SELECT 'profiles', count(*) FROM profiles
   UNION ALL
   SELECT 'resumes', count(*) FROM resumes;
   "
   ```

2. **Verify Field-Level Encryption Decryption:**
   - Execute test query verifying that `phone_encrypted` and `city_encrypted` can be decrypted using the active `ENCRYPTION_MASTER_KEY`.

3. **Verify API Readiness:**

   ```bash
   curl -sS http://localhost:4000/health/ready
   ```

4. **Log the Monthly Drill:**
   - Document date, backup snapshot timestamp, duration of restore, and verifier name in `/docs/runbooks/drill-log.md`.
