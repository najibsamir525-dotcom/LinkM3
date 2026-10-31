# ADR-004: Development Object Storage Emulation & Production Cloudflare R2 Strategy

## Status

Accepted

## Date

2026-10-31

## Context

1. LINKME requires S3-compatible object storage for profile avatars, resume attachments, generated PDF documents, and compliance archives.
2. In production, LINKME uses **Cloudflare R2** via `@aws-sdk/client-s3` (Apache-2.0). Cloudflare R2 has zero egress fees, full S3 API compatibility, and carries zero AGPL license footprint.
3. For offline local development and CI smoke tests, an S3-compatible container emulator is required.
4. In late 2025, MinIO Inc. ceased unauthenticated distribution of official `minio/minio` community images on Docker Hub, archiving them and restricting unauthenticated pulls (`pull access denied for minio/minio`).
5. Running dev containers must be deterministic, reproducible, and strictly pinned to avoid registry pull failures or unexpected breaking changes.

## Decision

1. **Local Development Image:** Use pinned Docker image `bitnamilegacy/minio:2025.7.23-debian-12-r5` in `docker-compose.yml`.
2. **Production Isolation:** MinIO is strictly confined to local development (`docker-compose.yml`). It is **never** packaged, built, or executed in staging or production container images.
3. **Application Decoupling:** The application codebase interacts exclusively through `@aws-sdk/client-s3` over standard HTTP/HTTPS S3 protocol. The application has zero direct dependency on MinIO libraries or AGPL code.
4. **Maintenance Alternatives Evaluated:**
   - _Upstream MinIO Docker Hub:_ Inaccessible without commercial credentials (pull access denied).
   - _Chainguard MinIO:_ Requires commercial Chainguard subscription.
   - _Adobe S3Mock (`adobe/s3mock`):_ Lightweight mock, but lacks standard MinIO web console for visual asset inspection.
   - _Bitnami Pinned Build (`bitnamilegacy/minio:2025.7.23-debian-12-r5`):_ Publicly available, reproducible, verified compatibility with S3 API and web console.

## Consequences

- **Positive:** Local development requires no cloud credentials, zero network egress costs, and offline operation works seamlessly.
- **Positive:** Pinned image prevents registry deprecation surprises.
- **Security & Legal:** Zero AGPL contamination in production deliverables; compliant with corporate IP standards.
