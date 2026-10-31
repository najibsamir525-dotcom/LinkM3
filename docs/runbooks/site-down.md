# Runbook: Site Down (P1 Critical Outage)

**Document Version:** 1.0.0  
**Classification:** Incident Response / Operational Runbook  
**Severity:** P1 — Complete Service Disruption  
**Trigger:** Better Uptime alert: `/health/live` or public landing page unreachable for > 2 minutes.

---

## 1. Initial Triage (First 5 Minutes)

1. **Verify Outage Scope:**

   ```bash
   # Test from external network
   curl -I -sS https://linkme.cv/health/live
   curl -I -sS https://linkme.cv/health/ready
   ```
   - If HTTP 200 on `/health/live` but 503 on `/health/ready`: Database/internal dependency issue (proceed to Section 2.2).
   - If connection refused or timeout: Host VM or Nginx reverse proxy issue (proceed to Section 2.1).
   - If SSL error: Cloudflare edge or Let's Encrypt renewal issue.

2. **Access Host VM:**

   ```bash
   ssh -i ~/.ssh/linkme_vm_key deploy@<VM_IP>
   ```

3. **Check Container Status:**
   ```bash
   cd /opt/linkme
   docker compose -f docker-compose.prod.yml ps
   ```

---

## 2. Root Cause Remediation

### 2.1 Reverse Proxy / Gateway Down (Nginx)

```bash
# Check gateway logs
docker compose -f docker-compose.prod.yml logs --tail 100 gateway

# Restart gateway container
docker compose -f docker-compose.prod.yml restart gateway
```

### 2.2 API Crash / OOM (NestJS)

```bash
# Check if API container is in CrashLoopBackOff or killed by OOM
docker compose -f docker-compose.prod.yml logs --tail 100 api

# Check system dmesg for OOM killer invocations
dmesg -T | grep -i oom

# Restart API container
docker compose -f docker-compose.prod.yml restart api
```

### 2.3 PostgreSQL Down or Locked

```bash
# Inspect Postgres logs
docker compose -f docker-compose.prod.yml logs --tail 100 postgres

# Check disk space on host (Postgres shuts down if disk is 100% full)
df -h

# Check if Postgres responds to internal ping
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U linkme_user -d linkme_db

# If safe, restart database container
docker compose -f docker-compose.prod.yml restart postgres
```

---

## 3. Post-Remediation Verification

1. **Verify Health Probes:**

   ```bash
   curl -sS https://linkme.cv/health/live | grep -q "ok" && echo "Liveness probe: PASS"
   curl -sS https://linkme.cv/health/ready | grep -q "connected" && echo "Readiness probe: PASS"
   ```

2. **Verify Public Page:**

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" https://linkme.cv
   ```

3. **Update Status Page / Incident Log:**
   - Record exact incident start, detection time, remediation time, and root cause in incident tracker.
