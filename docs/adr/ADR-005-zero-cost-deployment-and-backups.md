# ADR-005: Zero-Cost Deployment Architecture & Encrypted Cloudflare R2 Backups

**Date:** 2026-10-29  
**Status:** Accepted

## Context

The platform requires a production-grade deployment model achieving $0 operational cost for the MVP, run as a single Docker Compose stack on a free cloud VM (e.g. Oracle Always Free 4 OCPU / 24GB RAM ARM or cheap alternative), with automated encrypted backups and tested disaster recovery.

## Decision

1. **Single Docker Compose Stack:**
   - Unified stack orchestrating `gateway` (Nginx + Let's Encrypt), `web` (Next.js SSR/CSR), `api` (NestJS Fastify), `worker` (Playwright BullMQ single concurrency), `postgres` (PostgreSQL 16), and `redis` (Redis 7).
   - Strict network partitioning: `data-net` is isolated with `internal: true` so the database and Redis cannot be contacted directly from the internet.
2. **Encrypted Backups to Cloudflare R2:**
   - Daily cron script runs `pg_dump -Fc` piped directly through `gpg --symmetric` (AES-256) into a private Cloudflare R2 bucket (`linkme-backups/postgres/`).
   - Cloudflare R2 provides 10 GB of storage and $0 egress fees forever.
   - S3 lifecycle rule auto-purges backups older than 30 days.
3. **Billing Deferred:**
   - The data model (`plans`, `subscriptions`, `payments`) and interfaces are fully defined in Phase 0.
   - Merchant-of-record integration (Lemon Squeezy / Paddle) is deferred until Phase 4 and formal approval.

## Consequences

- The platform can run indefinitely on free-tier infrastructure.
- Complete DR restore procedure is verified with a single shell script (`/scripts/restore-db.sh`).
