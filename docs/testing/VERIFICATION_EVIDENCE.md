# Phase 0 to Phase 1 Verification Evidence Matrix

**Date:** 2026-10-30  
**Phase:** Phase 0 Completion & Phase 1 Authorization  
**Inspector:** Senior Staff Security & Privacy Engineer

---

## 1. Traceability & Use Case Test Verification Registry

Every use case defined in the product specification (UC-01 through UC-33) has been assigned a concrete verification target. In Phase 1, each corresponding domain test file will be instantiated and verified before advancing.

| Use Case ID | Requirement Scope                                                    | Automated Test Suite Target File                               | Status              |
| :---------- | :------------------------------------------------------------------- | :------------------------------------------------------------- | :------------------ |
| **UC-01**   | Age Gate 18+ & Terms/Privacy Signup (No DOB)                         | `packages/domain/test/auth/signup-age-gate.spec.ts`            | Phase 1 Foundation  |
| **UC-02**   | Email verify, Argon2id auth, 2FA TOTP, session revocation            | `packages/domain/test/auth/session-management.spec.ts`         | Phase 1 Foundation  |
| **UC-03**   | Granular consent recording & withdrawal                              | `packages/domain/test/compliance/consent-ledger.spec.ts`       | Phase 1 Foundation  |
| **UC-04**   | Self-service data export (JSON + assets)                             | `packages/domain/test/compliance/data-export.spec.ts`          | Phase 1 Foundation  |
| **UC-05**   | Cascading account erasure (30-day timeline)                          | `packages/domain/test/compliance/account-erasure.spec.ts`      | Phase 1 Foundation  |
| **UC-06**   | AI objection / opt-out                                               | `packages/domain/test/compliance/ai-objection.spec.ts`         | Phase 1 Foundation  |
| **UC-07**   | Master Profile CRUD & contact info                                   | `packages/domain/test/profile/profile-crud.spec.ts`            | Phase 1 Foundation  |
| **UC-08**   | Experiences, Educations, Skills, Projects, Languages, Proofs         | `packages/domain/test/profile/sub-entities.spec.ts`            | Phase 1 Foundation  |
| **UC-09**   | Custom sections & typed custom fields (JSONB, no migration)          | `packages/domain/test/profile/custom-sections.spec.ts`         | Phase 1 Foundation  |
| **UC-10**   | Sensitive fields optional, off by default, AES-256-GCM encrypted     | `packages/domain/test/profile/sensitive-fields-crypto.spec.ts` | Phase 1 Foundation  |
| **UC-11**   | Create resume from template (LTR/RTL)                                | `packages/domain/test/resumes/resume-creation.spec.ts`         | Phase 2 Editor      |
| **UC-12**   | Reorder sections/items & live preview                                | `packages/domain/test/resumes/reorder-sections.spec.ts`        | Phase 2 Editor      |
| **UC-13**   | Resume item override without mutating Master Profile                 | `packages/domain/test/resumes/item-overrides.spec.ts`          | Phase 2 Editor      |
| **UC-14**   | Duplicate resume for job tailoring                                   | `packages/domain/test/resumes/duplicate-resume.spec.ts`        | Phase 2 Editor      |
| **UC-15**   | Version history & snapshot rollback                                  | `packages/domain/test/resumes/version-history.spec.ts`         | Phase 4 Sharing/Ops |
| **UC-16**   | Style customization within template bounds                           | `packages/domain/test/resumes/style-customization.spec.ts`     | Phase 2 Editor      |
| **UC-17**   | Bilingual Arabic/English resume with bidi mirroring                  | `packages/domain/test/resumes/bilingual-bidi.spec.ts`          | Phase 2 Editor      |
| **UC-18**   | Headless Chromium PDF export (ATS-safe, vector text, print fallback) | `packages/domain/test/export/pdf-renderer.spec.ts`             | Phase 2 Editor      |
| **UC-19**   | Share link generation (unlisted, expiring, optional password)        | `packages/domain/test/sharing/share-links.spec.ts`             | Phase 4 Sharing     |
| **UC-20**   | Privacy-first country-level analytics (No IPs)                       | `packages/domain/test/sharing/link-analytics.spec.ts`          | Phase 4 Sharing     |
| **UC-21**   | Visitor opens public CV link (cached, read-heavy, noindex)           | `packages/domain/test/sharing/public-cv.spec.ts`               | Phase 4 Sharing     |
| **UC-22**   | CV Import (PDF/DOCX) -> OCR/Text -> LLM -> JSON -> Review Screen     | `packages/domain/test/ai/cv-import-review.spec.ts`             | Phase 3 AI Pipeline |
| **UC-23**   | Job description tailoring with individual accept/reject              | `packages/domain/test/ai/job-tailoring.spec.ts`                | Phase 3 AI Pipeline |
| **UC-24**   | ATS Score evaluation & keyword gap analysis                          | `packages/domain/test/ai/ats-scorer.spec.ts`                   | Phase 3 AI Pipeline |
| **UC-25**   | Writing assistant & translation (Arabic <-> English)                 | `packages/domain/test/ai/writing-assistant.spec.ts`            | Phase 3 AI Pipeline |
| **UC-26**   | AI quota & credit balance tracking                                   | `packages/domain/test/ai/credit-ledger.spec.ts`                | Phase 3 AI Pipeline |
| **UC-27**   | Upfront pricing preview (Deferred during Free Beta)                  | `packages/domain/test/billing/pricing-display.spec.ts`         | Phase 4 Billing     |
| **UC-28**   | Hosted checkout & idempotent webhook handling                        | `packages/domain/test/billing/hosted-checkout.spec.ts`         | Phase 4 Billing     |
| **UC-29**   | One-click cancellation & statutory withdrawal rights                 | `packages/domain/test/billing/cancellation.spec.ts`            | Phase 4 Billing     |
| **UC-30**   | Admin: template management & publishing                              | `packages/domain/test/admin/template-admin.spec.ts`            | Phase 4 Admin       |
| **UC-31**   | Admin: moderation & account suspension with audit trail              | `packages/domain/test/admin/moderation.spec.ts`                | Phase 4 Admin       |
| **UC-32**   | Admin: operational metrics & AI cost limit controls                  | `packages/domain/test/admin/metrics.spec.ts`                   | Phase 4 Admin       |
| **UC-33**   | Admin: data subject request SLA tracking (30-day countdown)          | `packages/domain/test/admin/data-requests.spec.ts`             | Phase 4 Admin       |

---

## 2. Multi-Tenant Negative Authorization Matrix (Anti-IDOR Targets)

Every endpoint created in Phase 1 and subsequent phases is tested against this matrix in CI.

| Request Pattern                             | Target Resource | Tenant A (Owner) | Tenant B (Attacker) | Expected Result for Tenant B               |
| :------------------------------------------ | :-------------- | :--------------- | :------------------ | :----------------------------------------- |
| `GET /api/v1/profiles/:id`                  | Profile         | Allowed (200)    | Forbidden           | **404 Not Found** (Prevent ID enumeration) |
| `PATCH /api/v1/profiles/:id`                | Profile         | Allowed (200)    | Forbidden           | **404 Not Found**                          |
| `GET /api/v1/profile/experiences/:id`       | Experience      | Allowed (200)    | Forbidden           | **404 Not Found**                          |
| `DELETE /api/v1/profile/certifications/:id` | Certification   | Allowed (200)    | Forbidden           | **404 Not Found**                          |
| `POST /api/v1/assets/upload-intent`         | Asset Quota     | Allowed (201)    | Isolated            | User B cannot associate upload with User A |
| `GET /api/v1/consents`                      | Consent Ledger  | Allowed (200)    | Forbidden           | **404 Not Found**                          |
| `POST /api/v1/privacy/erasure-request`      | User Account    | Allowed (202)    | Forbidden           | User B cannot trigger deletion of User A   |
