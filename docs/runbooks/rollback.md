# Runbook: Application & Schema Rollback

**Document Version:** 1.0.0  
**Classification:** Deployment & Emergency Operations  
**Severity:** P1/P2 Depending on Blast Radius  
**Trigger:** Post-deployment smoke test failure, error rate spike, or unrecoverable defect in production.

---

## 1. Quick Summary (One-Command Manual Rollback)

To immediately restore the production environment to the previous stable release:

```bash
# On the production VM:
/opt/linkme/scripts/rollback.sh <PREVIOUS_COMMIT_SHA>
```

---

## 2. Step-by-Step Rollback Procedure

### Step 2.1: Roll Back Application Container Images

1. Identify the previous stable Git SHA from the deployment log or GitHub Releases:

   ```bash
   PREV_SHA="a1b2c3d4" # Replace with verified stable SHA
   ```

2. Update the image tag in `/opt/linkme/.env.production`:

   ```bash
   sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${PREV_SHA}/" /opt/linkme/.env.production
   ```

3. Pull previous image and restart services:

   ```bash
   docker compose -f /opt/linkme/docker-compose.prod.yml pull api web worker
   docker compose -f /opt/linkme/docker-compose.prod.yml up -d --remove-orphans api web worker
   ```

4. Verify health probes immediately:
   ```bash
   curl -f http://localhost:4000/health/ready || (echo "Rollback health check failed!" && exit 1)
   ```

---

### Step 2.2: Roll Back Database Schema (If Migrations Were Run)

Under the **Expand/Contract** policy, schema changes in the current deploy were non-breaking additions (new columns/tables). If a schema rollback is strictly required:

1. **Option A: Apply Dedicated Down Migration Script (Preferred & Non-Destructive):**

   ```bash
   # Run the paired down script for the latest migration
   docker compose -f /opt/linkme/docker-compose.prod.yml exec -T postgres psql -U linkme_user -d linkme_db \
     < /opt/linkme/packages/db/drizzle/000X_migration_name_down.sql
   ```

2. **Option B: Full Pre-Deploy Snapshot Restore (Disaster Recovery Only):**
   _Use only if data corruption or structural mismatch prevents forward operation._
   ```bash
   # See docs/runbooks/backup-restore.md for complete instructions
   /opt/linkme/scripts/restore-pre-deploy-backup.sh ${PREV_SHA}
   ```

---

## 3. Rollback Verification Checklist

- [ ] `/health/live` returns HTTP 200 `{"status":"ok"}`
- [ ] `/health/ready` returns HTTP 200 `{"status":"ok","database":"connected"}`
- [ ] User login flow passes
- [ ] Master Profile edit & save passes
- [ ] PDF export queue processes a test job without error
- [ ] Sentry error rate drops below alert threshold
- [ ] Send incident resolution notification to Telegram channel
