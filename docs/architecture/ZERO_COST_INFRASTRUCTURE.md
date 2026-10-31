# Zero-Cost Infrastructure & Free-Tier Operational Specification

**Document Version:** 1.0.0-draft  
**Status:** Under Review (Phase 0)  
**Authors:** Senior Staff Engineer, DevOps & Platform Security

---

## 1. Free-Tier Component Audit & Economic Limits Matrix

Every component has been verified against current official documentation for **commercial use viability**, free-tier quota boundaries, failure behaviors, and minimal-cost scale-out paths.

| Component / Layer        | Technology & Free Provider                                                                         | Free-Tier Limits (Permits Commercial Use)                                                                                                               | What Happens When Limit Exceeded                                                                                                         | Cheapest Upgrade Path                                                                                                               |
| :----------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **Compute / Host VM**    | **Self-Hosted Docker Compose** on **Oracle Cloud Always Free** (or Hetzner CAX11 / Local)          | • 4 Ampere A1 ARM OCPUs + 24 GB RAM (Oracle)<br/>• 200 GB Block Storage<br/>• 10 TB/month outbound bandwidth                                            | Oracle stops new instance creation; existing instances run continuously unless idle reclaimed (prevented by health checks).              | Hetzner Cloud VPS (CAX11 ARM: 2 vCPU, 4GB RAM at ~€3.29/month).                                                                     |
| **Edge CDN, WAF & DNS**  | **Cloudflare Free Plan**                                                                           | • Unlimited bandwidth & DDoS protection<br/>• 3 Page Rules / Free WAF Managed Rules<br/>• Commercial use permitted                                      | Non-cached traffic bypasses cache; Rate limiting defaults to standard edge thresholds; DDoS protection remains active.                   | Cloudflare Pro ($20/month) or continue on Free with strict caching headers.                                                         |
| **Relational Database**  | **PostgreSQL 16** (Docker container on Host VM)                                                    | • Limited only by Host VM Disk (200 GB free on Oracle, or 25 GB on free Neon DB fallback: 0.5 GB storage, 190 hours/mo)                                 | Postgres disk fills -> server enters read-only emergency state. Monitored via disk alerts at 80%.                                        | Increase VM disk volume or migrate to Neon Scale ($19/mo) / Supabase Pro ($25/mo) / Hetzner dedicated storage (€1.50/mo per 100GB). |
| **Cache & Queue**        | **Valkey 7.2+ (Docker container on Host VM)**                                                      | • Limited only by assigned Docker memory limit (`mem_limit: 256m`) with `maxmemory-policy: allkeys-lru`<br/>• 100% open source BSD-3-Clause             | LRU eviction discards oldest cached queries; BullMQ jobs are persisted to append-only file (AOF) so active queue jobs are never dropped. | Increase Valkey RAM limit in `docker-compose.yml` (free within the 24GB host VM).                                                   |
| **Object Storage**       | **Cloudflare R2**                                                                                  | • **10 GB storage / month**<br/>• **1,000,000 Class A (writes)** / month<br/>• **10,000,000 Class B (reads)** / month<br/>• **$0 egress fees** forever  | API calls return HTTP 429 or 403 on upload; downloads succeed until soft quota triggers billing.                                         | Cloudflare R2 Pay-as-you-go: **$0.015 / GB-month** storage and **$0 egress fees** (extra 10GB is literally $0.15/month).            |
| **PDF Rendering Worker** | **Playwright / Chromium Container** (Self-hosted BullMQ Worker)                                    | • Concurrency capped to 1 job on VM<br/>• CPU/RAM capped: 512 MiB RAM limit<br/>• Client-side `window.print()` fallback has **0 server resource usage** | Jobs queue up in BullMQ; user sees progress bar with estimated wait time.                                                                | Scale worker concurrency to 2 on existing VM, or offload heavy exports to AWS Lambda via container image (~$0.0001 per export).     |
| **AI Processing**        | **3-Mode Abstraction**:<br/>1. Disabled (MVP default)<br/>2. BYOK (User key)<br/>3. Paid-tier only | • **Cost to Platform: $0**<br/>• BYOK mode runs on user's personal quota<br/>• Disabled mode consumes 0 resources                                       | In BYOK mode: user's personal API quota limits apply (HTTP 429 from provider displayed gracefully in UI).                                | Enable Paid-users-only mode with user credits or subscription pass.                                                                 |
| **Email Delivery**       | **Resend / Brevo (Sendinblue) Free Tier**                                                          | • Resend: 3,000 emails/month (100/day)<br/>• Brevo: 300 emails/day (9,000/month) free<br/>• DKIM/SPF custom domain allowed                              | Emails queued or rejected if daily threshold hit; UI displays clear message to retry next day.                                           | Resend Pro ($20/month for 50,000 emails) or Amazon SES ($0.10 per 1,000 emails -> practically cents).                               |
| **Error Monitoring**     | **Sentry Developer Free Tier** or self-hosted GlitchTip                                            | • 5,000 errors / month<br/>• 10,000 performance units / month                                                                                           | Sentry drops additional events until billing cycle resets. Local Pino logs still capture everything.                                     | Self-hosted GlitchTip (Docker container on VM, 100% open-source) or Sentry Team ($26/month).                                        |
| **Web Analytics**        | **In-House Privacy Analytics** (`link_views` partitioned)                                          | • 100% free, runs in PostgreSQL with 0 external tracking scripts and 0 cookie banners required for analytics                                            | Partition drops older than 180 days automatically via cron. 0 external limits.                                                           | None required; self-hosted and zero-cost.                                                                                           |

---

## 2. Docker Compose Unified Stack Specification

The entire production stack runs as a unified, coordinated Docker Compose system requiring **zero paid managed services**:

```yaml
version: "3.8"

services:
  # 1. Reverse Proxy & SSL Termination
  gateway:
    image: nginx:1.27-alpine
    container_name: linkme-gateway
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infra/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./infra/certbot/conf:/etc/letsencrypt:ro
      - ./infra/certbot/www:/var/www/certbot:ro
    depends_on:
      - web
      - api
    networks:
      - public-net
      - app-net

  # 2. Next.js Frontend Application
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: linkme-web
    restart: always
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://linkme.cv/api/v1
    networks:
      - app-net

  # 3. NestJS Stateless Backend API
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: linkme-api
    restart: always
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public
      - REDIS_URL=redis://redis:6379
      - R2_ENDPOINT=${R2_ENDPOINT}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - ENCRYPTION_MASTER_KEY=${ENCRYPTION_MASTER_KEY}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-net
      - data-net

  # 4. Asynchronous Queue Worker (PDF, AI, File Parsing)
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    container_name: linkme-worker
    restart: always
    mem_limit: 768m
    cap_drop:
      - ALL
    cap_add:
      - SYS_ADMIN # Required strictly for Chromium seccomp sandbox
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public
      - REDIS_URL=redis://redis:6379
      - R2_ENDPOINT=${R2_ENDPOINT}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - WORKER_CONCURRENCY_PDF=1
      - AI_PIPELINE_MODE=disabled # 'disabled' | 'byok' | 'paid'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-net
      - data-net

  # 5. PostgreSQL 16 Primary Database
  postgres:
    image: postgres:16-alpine
    container_name: linkme-postgres
    restart: always
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - data-net

  # 6. Valkey 7.2+ Cache & BullMQ Broker (BSD 3-Clause)
  valkey:
    image: valkey/valkey:7.2-alpine
    container_name: linkme-valkey
    restart: always
    mem_limit: 256m
    command:
      [
        "valkey-server",
        "--appendonly",
        "yes",
        "--maxmemory",
        "200mb",
        "--maxmemory-policy",
        "allkeys-lru",
      ]
    volumes:
      - valkey-data:/data
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - data-net

networks:
  public-net:
    driver: bridge
  app-net:
    driver: bridge
  data-net:
    internal: true # STRICT ISOLATION: No inbound/outbound external internet access for DB & Redis

volumes:
  postgres-data:
  valkey-data:
```

---

## 3. Scheduled Automated Backups & Disaster Recovery Restore Runbook

### 3.1 Backup Strategy ($0 Cost via Cloudflare R2)

- Backups execute daily at `02:00 UTC` via a lightweight alpine cron container or host systemd timer.
- Database is dumped using `pg_dump -Fc` (custom compressed format), piped through `gpg` symmetric encryption (AES-256), and streamed directly to Cloudflare R2 bucket `linkme-backups/postgres/`.
- S3 lifecycle rule automatically deletes backup archives older than **30 days** (enforcing retention schedule).

```bash
#!/usr/bin/env bash
# /scripts/backup-db.sh - Automated Encrypted Backup to Cloudflare R2
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_NAME="linkme_db_${TIMESTAMP}.dump.enc"

echo "[$(date)] Starting encrypted database backup..."

docker exec linkme-postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc \
  | gpg --symmetric --batch --yes --passphrase "${BACKUP_ENCRYPTION_PASSPHRASE}" --cipher-algo AES256 \
  | aws s3 cp - "s3://${R2_BACKUP_BUCKET}/postgres/${BACKUP_NAME}" \
      --endpoint-url "${R2_ENDPOINT}"

echo "[$(date)] Backup completed and verified in R2: ${BACKUP_NAME}"
```

### 3.2 Tested Restore Procedure Runbook

To verify disaster recovery and test backup integrity (tested in Phase 5 drill):

1. Download encrypted backup from R2:
   ```bash
   aws s3 cp "s3://${R2_BACKUP_BUCKET}/postgres/linkme_db_TARGET.dump.enc" ./backup.dump.enc --endpoint-url "${R2_ENDPOINT}"
   ```
2. Decrypt using master passphrase:
   ```bash
   gpg --decrypt --batch --passphrase "${BACKUP_ENCRYPTION_PASSPHRASE}" backup.dump.enc > backup.dump
   ```
3. Restore into clean test container:
   ```bash
   docker exec -i linkme-postgres pg_restore -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists backup.dump
   ```
4. Run automated integrity check verifying table counts and user record hashes.

---

## 4. PDF Generation Architecture: Playwright Worker + Client Fallback

### 4.1 Server-Side Playwright Headless Worker

- Single worker concurrency (`concurrency: 1`) to eliminate CPU/RAM spikes on the host VM.
- Isolated container running unprivileged user with no direct access to public networks.
- Chromium prints using exact CSS print media queries (`@media print`) and standard `@page` margin geometry:
  ```typescript
  await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    preferCSSPageSize: true,
  });
  ```
- All Arabic and Latin fonts are pre-cached locally inside container `/fonts` to guarantee 100% offline glyph rendering.

### 4.2 Browser Client-Side Print-to-PDF Fallback (`window.print()`)

To ensure high availability even when the server queue is congested or worker is under load:

- The UI provides an instantaneous **"Direct Print / Save as PDF"** button.
- Triggers standard browser print dialog styled with the identical print stylesheet.
- **Benefits:**
  - 0 CPU and 0 RAM consumed on server.
  - 100% client-side privacy (no document leaves the user's browser).
  - Instantaneous with zero network latency.

---

## 5. AI Pipeline: 3-Mode Provider Abstraction & Data Privacy Terms

In accordance with strict zero-cost and privacy constraints:
**AI features are OFF by default in the MVP build.**

### 5.1 Three-Mode Operational Specification

The backend AI module implements a strict strategy pattern:

```typescript
export interface AiProvider {
  parseResume(rawText: string): Promise<ParsedResumeDto>;
  tailorContent(
    resume: ResumeDto,
    jobDescription: string,
  ): Promise<TailorSuggestionsDto>;
  evaluateAts(
    resume: ResumeDto,
    jobDescription?: string,
  ): Promise<AtsScoreResultDto>;
  translateText(text: string, targetLanguage: "en" | "ar"): Promise<string>;
}
```

1. **Mode 1: `disabled` (MVP Default)**
   - Returns a clear, friendly UI notification: _"AI Assistant is currently offline or disabled in this instance."_
   - Consumes $0, makes 0 network calls, and shares 0 user data.
2. **Mode 2: `byok` (Bring-Your-Own-API-Key)**
   - User inputs their own Gemini API Key or OpenAI API Key in a modal.
   - The key is held exclusively in browser memory (session storage) or encrypted client cookie.
   - Request is made client-side or proxied with user key; platform incurs **$0 cost**.
   - Explicit disclaimer displayed regarding provider's privacy policy.
3. **Mode 3: `paid-users-only` (Platform Enterprise Tier - Deferred)**
   - Enabled only when billing and paid credit packs are activated.
   - Uses enterprise Vertex AI or Gemini pay-as-you-go with signed DPA ensuring zero data training.

### 5.2 Provider Data Privacy Terms Audit

| Provider & Tier                              | Permits Commercial Use?         | Does Provider Train Models on Input Data?                                                             | Permitted on LINKME Platform?                                  |
| :------------------------------------------- | :------------------------------ | :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **Google Gemini API (Free Tier)**            | Yes                             | **YES.** Google's terms state prompts & responses may be logged and human-reviewed to train products. | ❌ **STRICTLY PROHIBITED** on LINKME (violates GDPR & Law 81). |
| **Google Gemini API (Pay-as-you-go / Paid)** | Yes                             | **NO.** Under paid API terms, data is NOT used to train Google models.                                | ✅ Permitted for Paid mode (Phase 3+).                         |
| **OpenAI API (Paid / Platform)**             | Yes                             | **NO.** OpenAI API business terms default to zero training on API inputs.                             | ✅ Permitted for BYOK and Paid mode.                           |
| **Local Ollama / Llama 3 (Self-Hosted)**     | Yes (Llama 3 Community License) | **NO.** Runs entirely on local machine/server; 100% private.                                          | ⚠️ Resource heavy: requires GPU or >= 16GB RAM VM.             |

---

## 6. Comprehensive Zero-Cost Monitoring, Observability & Alerting

### 6.1 Monitoring Component Audit & Quota Boundaries

| Component                | Free Provider & Tier                             | Limits & Quota Boundaries (Verified Commercial)                                                                                                        | What Happens When Limit Exceeded                                                                                  | Cheapest Upgrade Path                                                            |
| :----------------------- | :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **Uptime Monitoring**    | **Better Uptime / Cronitor / Gatus** (Free Tier) | • 50 HTTP/HTTPS monitors<br/>• 3-minute checks on `/health/live` & public page<br/>• Email & Webhook notifications                                     | Checks pause or alert frequency drops to 10 min; existing alerts fire.                                            | Better Uptime Freelance ($10/mo) or self-hosted Gatus container (0 cost).        |
| **Error Tracking**       | **Sentry Developer (Free Tier)**                 | • 5,000 error events / month<br/>• 10,000 performance units / month<br/>• PII scrubbing active before event transmission                               | Additional error events are dropped until the monthly cycle resets. Local Pino logs still capture 100% of errors. | Sentry Team ($26/mo) or self-hosted GlitchTip (Docker on VM, 100% open source).  |
| **System & App Metrics** | **Hosted Grafana Cloud (Free Tier)**             | • 10,000 active metric series<br/>• 50 GB log volume / month<br/>• 50 GB trace volume / month<br/>• 3 alert rules with 14-day data retention           | Ingestion soft-caps; older metrics age out after 14 days. No surprise billing.                                    | Grafana Pro ($29/mo + usage) or self-hosted Prometheus/cAdvisor on VM.           |
| **Structured Logs**      | **Pino (Structured JSON) + logrotate**           | • Capped strictly by host disk allocation (5 GB max for logs)<br/>• 30-day retention with daily gzip rotation<br/>• In-memory PII serializer redaction | logrotate prunes files older than 30 days; disk never fills.                                                      | Offload archived compressed logs to Cloudflare R2 archive bucket ($0.015/GB-mo). |
| **Cron Job Heartbeats**  | **Healthchecks.io (Free Tier)**                  | • 20 distinct check endpoints<br/>• Pings on automated backup and account deletion cleanup jobs<br/>• Dead-man's switch alerts on missed execution     | Missing checks trigger Telegram / Email alert after configurable grace period.                                    | Healthchecks Supporter plan ($5/mo for 100 checks) or self-hosted Healthchecks.  |
| **Alert Notification**   | **Telegram Bot API + SMTP**                      | • Unlimited messages via Telegram Bot API<br/>• Zero cost forever, commercial use permitted<br/>• Instant push notifications on iOS/Android/Desktop    | Rate limited to 30 messages/second (unreachable in standard operational alert flows).                             | None needed; Telegram Bot API is permanently free and robust.                    |

### 6.2 Why Hosted Grafana Cloud is Preferred Over Self-Hosted Prometheus on Small VMs

On resource-constrained single-VM hosts (e.g., 1-4 OCPUs, 1-6 GB RAM), running Prometheus (`~500MB - 1GB RAM`), Alertmanager (`~100MB`), and Grafana (`~250MB`) consumes over 1.5 GB of system memory simply to monitor the node. Utilizing Grafana Cloud's generous Free Tier allows shipping metrics and logs via lightweight OpenTelemetry / Grafana Alloy agents consuming less than 40 MB of RAM, reserving 95%+ of VM compute exclusively for application workloads (Postgres, Valkey, NestJS API, Chromium).

### 6.3 PII & Secret Scrubbing Specification (Pino & Sentry)

All application logging and error reporting enforce mandatory data minimization:

1. **Pino Serializers:** Redact keys matching `password`, `token`, `secret`, `authorization`, `cookie`, `phone`, `email`, `city`, `credit_card`.
2. **Sentry `beforeSend` Sanitization:**
   - Strips request headers: `Authorization`, `Cookie`, `X-CSRF-Token`.
   - Clears query parameters containing tokens or session IDs.
   - Sets user context to pseudonymous hash (`id: sha256(user.id)`), never raw email or IP.
   - Replaces IPv4/IPv6 with anonymized subnets (`192.168.1.0/24`, `2001:db8::/64`).

### 6.4 Operational Alerting Rules Matrix (Telegram & Email)

| Alert Trigger                | Evaluation Window            | Threshold                             | Severity          | Immediate Action Required                                          |
| :--------------------------- | :--------------------------- | :------------------------------------ | :---------------- | :----------------------------------------------------------------- |
| **Site Down**                | 2 consecutive checks (2 min) | `/health/live` != 200                 | **P1 - Critical** | Execute Site Down Runbook (`docs/runbooks/site-down.md`)           |
| **Database Unhealthy**       | 1 check (1 min)              | `/health/ready` == 503                | **P1 - Critical** | Inspect Postgres container status, locks, and disk space           |
| **High Error Spike**         | 5-minute rolling window      | > 10 unhandled errors/min             | **P2 - High**     | Review Sentry issue dashboard and recent deploy commits            |
| **Host Disk Utilization**    | Continuous                   | > 80% disk space used                 | **P2 - High**     | Execute DB Full Runbook (`docs/runbooks/db-full.md`)               |
| **Host Memory Exhaustion**   | 3-minute sustained           | > 85% RAM utilization                 | **P2 - High**     | Inspect Valkey memory, leak in API, or Chromium orphan processes   |
| **Backup Job Missed**        | Daily schedule + 1 hr grace  | Healthchecks.io ping missing          | **P2 - High**     | Execute Backup Restore Runbook (`docs/runbooks/backup-restore.md`) |
| **PDF Worker Failure Rate**  | 15-minute window             | > 5% export failure rate              | **P3 - Medium**   | Restart Chromium worker container, check memory limits             |
| **Queue Backlog Spike**      | 10-minute window             | > 20 jobs pending in BullMQ           | **P3 - Medium**   | Investigate worker throughput or scale concurrency to 2            |
| **Brute Force / Auth Spike** | 1-minute window              | > 5 failed logins / min per IP        | **P3 - Medium**   | Verify automated rate limiting / IP ban triggered                  |
| **Free-Tier Limit Approach** | Daily aggregation            | > 80% of any free tier (R2/Sentry/DB) | **P3 - Medium**   | Review usage trends, execute data retention purge if applicable    |

---

## 7. Multi-Environment Topology & Shared-Failure Risk Analysis

### 7.1 Environment Isolation Grid

| Parameter          | Local Development              | CI Runner (Ephemeral)        | Staging                                                       | Production                            |
| :----------------- | :----------------------------- | :--------------------------- | :------------------------------------------------------------ | :------------------------------------ |
| **Target Host**    | Developer workstation          | GitHub Actions Ubuntu runner | Dedicated Project on Host VM                                  | Dedicated Project on Host VM          |
| **Database**       | Local Postgres (`5432`)        | Ephemeral Testcontainers PG  | `linkme_db_staging`                                           | `linkme_db_production`                |
| **Secrets & Keys** | `.env` (gitignored, mock keys) | GitHub Action Secrets        | Dedicated Staging Keyring                                     | Restricted `.env.production` (`0600`) |
| **Encryption MEK** | Distinct Dev Hex Key           | Distinct CI Hex Key          | Distinct Staging Hex Key                                      | Distinct Production Hex Key           |
| **Data Seed**      | Developer fixtures             | Ephemeral test fixtures      | **Synthetic data only (Faker)**                               | Real user data (FLE encrypted)        |
| **Data Copy Rule** | N/A                            | N/A                          | **STRICT PROHIBITION: Never copy production data to staging** | Strict access control                 |

### 7.2 Shared-Failure Risk Analysis (Staging & Production on Same VM)

Running Staging and Production as two distinct Docker Compose projects (`linkme-prod` and `linkme-staging`) on a single shared VM enables true $0 infrastructure for the MVP, but introduces shared-fate failure modes:

| Failure Mode                  | Risk Description                                                                                                     | Architectural Mitigation                                                                                                                                                                                                |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CPU Starvation**            | Staging load tests or heavy test runs saturate CPU cores, throttling production API response latency.                | Apply Docker Compose `cpus: "1.0"` limits on all staging services; production services have priority reservation (`cpus: "2.5"`).                                                                                       |
| **Memory Exhaustion (OOM)**   | Memory leak in staging container causes Linux kernel OOM Killer to indiscriminately kill production Postgres or API. | Set strict `mem_limit` and `mem_reservation` on every container. Staging stack total RAM is capped to 25% of VM capacity.                                                                                               |
| **Disk Exhaustion**           | Unchecked staging logs or database dumps fill the root filesystem, forcing production Postgres into read-only panic. | Staging database runs on a separate mount/quota, and staging logs are capped to 1 GB max with aggressive 3-day logrotate.                                                                                               |
| **Port & Network Collisions** | Staging binds to production ports (e.g. 5432 or 80) causing deployment collision.                                    | Staging services are completely unmapped to host ports; internal communication occurs over private isolated bridge network (`staging-net`). Gateway routes traffic by Host header (`staging.linkme.cv` vs `linkme.cv`). |
| **Shared Kernel Panic**       | Catastrophic kernel bug or physical hardware fault halts the underlying VM.                                          | Documented in Disaster Recovery: automated R2 backups and one-command recreate script allow spinning up the stack on an alternate cloud provider in under 15 minutes.                                                   |

---

## 8. Zero-Cost CI/CD Pipeline Specification

### 8.1 GitHub Actions Workflow Architecture

```mermaid
flowchart TD
    PR[Pull Request Opened / Updated] --> LINT[Format & Typecheck]
    LINT --> UNIT[Unit Tests with Coverage]
    UNIT --> INT[Integration Tests with Testcontainers]
    INT --> SEC[Security Scans: Gitleaks, npm audit, Semgrep, Trivy]
    SEC --> E2E[Playwright Critical Flows & Axe WCAG 2.2 AA]
    E2E --> GATE{All Checks Pass?}
    GATE -- No --> REJECT[Block Merge]
    GATE -- Yes --> MERGE[Merge to main]

    MERGE --> BUILD[Build Multi-arch Container Image]
    BUILD --> TAG[Tag Image with Git SHA]
    TAG --> GHCR[Push to GitHub Container Registry]
    GHCR --> DEPLOY_STAGE[Auto-Deploy to Staging VM]
    DEPLOY_STAGE --> SMOKE_STAGE[Run Smoke & E2E on Staging]

    SMOKE_STAGE --> PROD_GATE{Manual Approval Gate}
    PROD_GATE -- Approved --> BACKUP_PROD[Automated Pre-deploy pg_dump Backup]
    BACKUP_PROD --> MIGRATE_PROD[Apply Expand Migrations]
    MIGRATE_PROD --> DEPLOY_PROD[Update Image Tag & Restart Containers]
    DEPLOY_PROD --> HEALTH_GATE{/health/ready == 200 within 60s?}
    HEALTH_GATE -- Yes --> SMOKE_PROD[Run Production Smoke Tests]
    HEALTH_GATE -- No --> AUTO_ROLLBACK[Automatic Rollback to Previous Image Tag]
    SMOKE_PROD -- Failed --> AUTO_ROLLBACK
    SMOKE_PROD -- Passed --> SUCCESS[Deploy Complete & Telegram Notification]
```

### 8.2 Production Deployment Safety Controls

1. **Pre-Deploy Database Snapshot:** Before executing migrations or swapping container images, a timestamped snapshot is dumped to the local backup directory and synchronized to Cloudflare R2 (`linkme-backups/pre-deploy/pre-deploy-$SHA.sql.gz`).
2. **Health-Check Gate:** The deployment runner polls `https://linkme.cv/health/ready` for up to 60 seconds (10 attempts every 6s). If the endpoint fails to return HTTP 200 with `database: "connected"`, the deployment is aborted.
3. **Automatic Rollback:** On health check failure or post-deploy smoke test failure, the deployment script executes an immediate rollback:
   ```bash
   # Re-points the image tag to PREVIOUS_SHA and restarts containers
   IMAGE_TAG=$PREVIOUS_SHA docker compose -f docker-compose.prod.yml up -d --remove-orphans
   ```
4. **One-Command Manual Rollback:**
   ```bash
   ./scripts/rollback.sh <TARGET_COMMIT_SHA>
   ```

### 8.3 CI Minute Budget & Caching Optimization

GitHub Actions provides **2,000 free Linux minutes/month** for public/private repositories.
To guarantee LINKME operates comfortably within the free tier (< 600 minutes/month):

1. **Dependency Caching:** `actions/setup-node@v4` with `cache: "npm"` eliminates redundant package downloads (saves ~2 minutes per run).
2. **Docker Layer Caching:** Container builds use GitHub Actions cache backend (`cache-from: type=gha`, `cache-to: type=gha,mode=max`) saving ~3 minutes per build.
3. **Selective Paths Filtering:** Workflows only trigger when relevant application files are modified (documentation changes in `/docs` bypass compute-heavy test suites).
4. **Target Pipeline Duration:** PR gate completes in $\le 4$ minutes.

---

## 9. Expand/Contract Migration Policy & Disaster Recovery

### 9.1 The Expand/Contract Rule (Zero-Downtime Safe)

Destructive schema changes (`DROP COLUMN`, `DROP TABLE`, `RENAME COLUMN`, `ALTER COLUMN ... NOT NULL`) are **STRICTLY PROHIBITED** in the same deployment as application code changes.
Migrations must follow a two-phase lifecycle:

1. **Phase 1 (Expand):**
   - Add new nullable columns or new tables.
   - Code writes to both old and new columns, but reads from old.
   - Deploy code and verify stability.
2. **Phase 2 (Migrate Data & Switch Reads):**
   - Background worker backfills new columns from old columns.
   - Code switches to read exclusively from new columns.
3. **Phase 3 (Contract):**
   - Remove old unused columns or constraints in a subsequent scheduled release.

### 9.2 Migration Rollback Strategy

Because Drizzle ORM does not generate down migrations automatically:

- Every forward migration `packages/db/drizzle/XXXX_name.sql` is accompanied by an authoritative, verified `packages/db/drizzle/XXXX_name_down.sql` script.
- Down scripts drop tables/constraints in exact reverse foreign-key order.
- In case of complex migration failure, disaster recovery falls back to restoring the pre-deployment `pg_dump` snapshot taken in Section 8.2.
