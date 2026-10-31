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
