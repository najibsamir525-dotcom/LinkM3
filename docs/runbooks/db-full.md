# Runbook: Database & Host Disk Full (> 80% Threshold)

**Document Version:** 1.0.0  
**Classification:** Operational Runbook  
**Severity:** P2 — Imminent Service Disruption  
**Trigger:** Host disk alert: filesystem utilization exceeds 80% on the host VM.

---

## 1. Initial Assessment

1. **Check Disk Usage by Mount:**

   ```bash
   df -h
   ```

2. **Identify Top Disk Consumers:**
   ```bash
   # Check Docker volume sizes
   docker system df -v

   # Check top directories in root filesystem
   du -sh /var/lib/docker/volumes/* /var/log /opt/linkme/* 2>/dev/null | sort -hr | head -n 10
   ```

---

## 2. Immediate Emergency Cleanup (Reclaim 5–20 GB)

1. **Clean Docker Build Cache and Dangling Images:**

   ```bash
   # Safe to run: removes only dangling images and build cache
   docker image prune -f
   docker builder prune -f --keep-storage 2GB
   ```

2. **Clean Rotated Application & System Logs:**
   ```bash
   # Truncate old syslog/journal logs older than 7 days
   journalctl --vacuum-time=7d

   # Compress or prune old Pino logs in /opt/linkme/logs
   find /opt/linkme/logs -type f -name "*.gz" -mtime +14 -delete
   ```

---

## 3. Database Volume Remediation (PostgreSQL)

If the disk growth is driven by `pgdata` volume:

1. **Check Table & Index Bloat:**

   ```bash
   docker compose -f docker-compose.prod.yml exec postgres psql -U linkme_user -d linkme_db -c "
   SELECT relname, pg_size_pretty(pg_total_relation_size(C.oid)) AS total_size
   FROM pg_class C LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
   WHERE nspname = 'public'
   ORDER BY pg_total_relation_size(C.oid) DESC LIMIT 10;
   "
   ```

2. **Drop Expired Link Views Partitions:**

   ```bash
   # Partitions older than 180 days are dropped per data retention policy
   docker compose -f docker-compose.prod.yml exec postgres psql -U linkme_user -d linkme_db -c "
   DROP TABLE IF EXISTS link_views_y2026m01;
   "
   ```

3. **Run VACUUM FULL on Heavily Updated Tables:**
   ```bash
   # Note: VACUUM FULL locks the table exclusively. Run during low-traffic window.
   docker compose -f docker-compose.prod.yml exec postgres psql -U linkme_user -d linkme_db -c "
   VACUUM ANALYZE sessions;
   VACUUM ANALYZE export_jobs;
   "
   ```

---

## 4. Scale-Out Prevention

If the legitimate database size exceeds 70% of the persistent block volume:

- Expand VM block volume via cloud console (e.g. Oracle Cloud Console $\rightarrow$ Block Storage $\rightarrow$ Edit Size).
- Rescan and expand partition on VM:
  ```bash
  sudo growpart /dev/sda 1
  sudo resize2fs /dev/sda1
  ```
