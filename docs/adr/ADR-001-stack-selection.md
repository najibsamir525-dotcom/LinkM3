# ADR-001: Technology Stack Selection: Modular Monolith (Next.js + NestJS + PostgreSQL + Drizzle)

**Date:** 2026-10-29  
**Status:** Accepted

## Context

We are building a production-grade CV/resume builder web platform supporting Arabic/English bilingual CVs, rich drag-and-drop structured editing, Headless Chromium PDF rendering, strict GDPR/Lebanon Law 81 compliance, and zero-cost infrastructure limits. We evaluated full-stack Next.js vs a decoupled Modular Monolith (Next.js + NestJS).

## Decision

We select a **TypeScript-First Modular Monolith**:

1. **Frontend:** Next.js (App Router, React 19) + Tailwind CSS with logical properties (RTL-first) + Radix UI / shadcn + dnd-kit + Tiptap + React Hook Form + Zod.
2. **Backend:** NestJS (Fastify adapter) organized into strict domain modules (`auth`, `profile`, `resume`, `export`, `ai`, `billing`, `compliance`, `admin`) with REST + OpenAPI (Swagger) and automated Zod validation pipes.
3. **Database & ORM:** PostgreSQL 16 with Drizzle ORM.
4. **Queue Broker:** Redis 7 with BullMQ.
5. **Storage:** Cloudflare R2 (S3-compatible, 10GB free tier, $0 egress).

## Rationale

- **Next.js frontend:** Provides optimal SSR for public CV share pages (`/cv/:slug`), ensuring fast initial page loads, dynamic OpenGraph meta tag generation, and seamless LTR/RTL switching.
- **NestJS backend:** Enforces clean separation of concerns and architectural boundaries (preventing spaghetti route handlers). Decouples background workers (PDF export, file parsing) cleanly while sharing Drizzle models and Zod DTO contracts.
- **Drizzle ORM over Prisma:** Prisma relies on a heavy Rust query engine binary that consumes substantial RAM (~150MB+ per process) and adds connection pooling friction on limited free-tier VMs. Drizzle is a lightweight TypeScript SQL builder with zero runtime overhead, native support for PostgreSQL partitioned tables (`link_views`), and instantaneous cold boots.
- **Tailwind Logical Properties:** Using `ms-`, `me-`, `ps-`, `pe-`, `start-`, and `end-` guarantees that swapping `dir="ltr"` to `dir="rtl"` instantly mirrors the layout without duplicate stylesheets or utility overrides.

## Consequences

- Requires running two lightweight Node.js processes (frontend and API) or deploying them in a unified Docker Compose configuration.
- Shared schemas and DTOs are maintained cleanly in a shared workspace package (`@linkme/shared`).
