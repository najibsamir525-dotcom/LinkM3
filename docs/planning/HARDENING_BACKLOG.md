# Phase 1 Production Hardening Backlog

**Document Status:** Active Tracking  
**Gate Requirement:** All items must be completed and verified before accepting real production user traffic.  
**Repository Authentication:** Limited-scope GitHub token active and verified (SHA 19e550a).

---

## 1. Live Smoke Test: Real Email Verification Flow via Mailpit

- **Current State:** The CI smoke test updates `email_verified = true` via `psql` shortcut to enable login.
- **Required Action:** Replace the direct SQL update with the real end-to-end verification flow:
  1. Trigger signup via `/api/auth/sign-up/email`.
  2. Query Mailpit REST API (`http://localhost:8025/api/v1/messages`) to locate the verification email sent via SMTP (`1025`).
  3. Extract the verification token / link from the email payload.
  4. Call `/api/auth/verify-email?token=...` via HTTP `GET`/`POST`.
  5. Assert status transitions to `ACTIVE` and verify subsequent login.

---

## 2. Live-Stack Security Rejection Tests

- **Current State:** Age gate, terms acceptance, and NIST password validations are tested in unit and in-process suites.
- **Required Action:** Extend the live-stack smoke test (`docker-compose-smoke`) to execute real HTTP rejection requests:
  - `POST /api/auth/sign-up/email` without `ageConfirmed: true` $\rightarrow$ Assert `400 Bad Request`.
  - `POST /api/auth/sign-up/email` without `termsAccepted: true` $\rightarrow$ Assert `400 Bad Request`.
  - `POST /api/auth/sign-up/email` with password `< 12` chars $\rightarrow$ Assert `400 Bad Request`.
  - `POST /api/auth/sign-up/email` with known breached password (`password12345`) $\rightarrow$ Assert `400 Bad Request`.
  - `POST /api/auth/reset-password` direct call attempting a weak password $\rightarrow$ Assert `400 Bad Request` (policy cannot be bypassed).

---

## 3. Branch Coverage Completion

- **`account-erasure.service.ts` (Line 132):**
  - Cover the catch branch during audit log anonymization when database query rejects.
  - Bring branches from 84.61% to 100%.
- **`better-auth.config.ts` Hook Branches:**
  - Add explicit unit tests for each Better Auth lifecycle hook branch (`user.create:before`, `user.create:after`, `password.hash`, `password.verify`).

---

## 4. Real CSRF Cookie-Based Rejection & Cookie Hardening

- **Required Action:**
  - Implement a dedicated test verifying that a cross-origin state-changing `POST` request originating from an untrusted site (`Origin: https://evil.com`), even when accompanied by a valid session cookie, is rejected by Fastify CSRF / CORS origin validation.
  - Document and enforce cookie security attributes:
    - `Secure: true` (only transmitted over HTTPS).
    - `HttpOnly: true` (inaccessible to JavaScript `document.cookie`).
    - `SameSite: "Lax"` (or `"Strict"` for sensitive mutations).
    - `Path: "/"` and `Domain` restrictions.

---

## 5. Test Matrix Disambiguation & Verified Totals

- **Mathematical Reconciliation (191 Tests Monorepo Total):**
  - **`@linkme/db` (63 Tests):**
    - 15 Real Server Engine Tests: 13 in `postgres-real-engine.spec.ts` (connecting to real PostgreSQL 16 container when `DATABASE_URL` is set, or in-process PGlite when unset) + 2 in `valkey-real-engine.spec.ts` (connecting via TCP socket to Valkey 7.2 container when `VALKEY_URL` is set).
    - 48 Drizzle Schema Structural Tests: 35 in `schema.spec.ts` + 13 in `schema-constraints.spec.ts`.
  - **`@linkme/domain` (59 Tests):**
    - 59 Pure Unit Tests (Argon2id hashing, AES-256-GCM FLE, Zod 4 schemas, upload validators, age gate, consent ledger, erasure orchestrator). Pure in-memory with zero network or database I/O.
  - **`@linkme/api` (69 Tests):**
    - 25 Integration Tests (7 in `user-journey.spec.ts` [Fastify injection + PGlite], 4 in `account-erasure.integration.spec.ts` [PGlite + storage], 7 in `better-auth-compliance.spec.ts` [PGlite], 5 in `security-headers-ratelimit.spec.ts` [Fastify injection], 2 in `pii-secret-scrubbing.spec.ts`).
    - 44 Service & Controller Unit Tests (10 `auth.service`, 3 `auth.controller`, 5 `auth.guard`, 9 `profile.service`, 4 `profile.controller`, 3 `health.controller`, 4 `account-erasure.service`, 5 `idor-http`, 1 PII scrub).
  - **Sum:** 63 (`@linkme/db`) + 59 (`@linkme/domain`) + 69 (`@linkme/api`) = **191 Tests Passing**.
