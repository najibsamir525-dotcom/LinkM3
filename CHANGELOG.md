# Changelog

All notable changes to the LINKME CV/Resume Builder Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed - Phase 0 Updates

- Updated minimum age gate specification to strict **18 years old** with zero date of birth collected.
- Switched in-memory store and queue broker from Redis to **Valkey 7.2+** (BSD-3-Clause) for absolute open-source licensing clarity.
- Clarified that the platform is **100% free during beta** with zero billing/payments activated in MVP, dormant billing schema, zero ads, and zero data sale.
- Documented 30-day full account erasure timeline, 30-day backup rolling window, 12-month security/audit logs, 12-month link analytics, and 7-day export file auto-deletion.
- Created [`docs/compliance/OPEN_QUESTIONS.md`](file:///c:/Users/user/Desktop/LINKME/docs/compliance/OPEN_QUESTIONS.md) containing assumptions and jurisdictional expansion roadmap (Lebanon/MENA launch vs. future EU/UK/US expansion).
- Added [`THIRD_PARTY_NOTICES.md`](file:///c:/Users/user/Desktop/LINKME/THIRD_PARTY_NOTICES.md) documenting attribution and runtime dynamically linked libvips licensing note for Sharp.
- **Architecture Specification (`/docs/architecture/ARCHITECTURE.md`):** Complete system topology, defense-in-depth security model, sandboxed Playwright Chromium worker, prompt-injection defense, and field-level encryption.
- **Relational Data Model (`/docs/architecture/DATA_MODEL.md`):** Reviewed starting ERD, proposed PostgreSQL 16 schema with field-level encryption for sensitive profile data, declarative table partitioning for `link_views`, soft-delete vs cascading hard-erasure lifecycle, and strict integrity constraints.
- **Traceability Matrix & Phased Plan (`/docs/planning/PHASED_PLAN_AND_TRACEABILITY.md`):** Full traceability mapping all 33 use cases (UC-01 to UC-33) to screens, API endpoints, database tables, and test suites across Phases 0 through 5.
- **Compliance Matrix (`/docs/compliance/COMPLIANCE_CHECKLIST.md`):** Regulatory checklist covering GDPR/UK GDPR, CCPA/CPRA, COPPA/Age Gate, ePrivacy, Lebanese Law 81/2018, EU AI Act, and WCAG 2.2 AA. Sub-processor registry and data retention schedules.
- **Risk Register (`/docs/security/RISK_REGISTER.md`):** Comprehensive threat matrix covering SSRF in Chromium, IDOR defense-in-depth, prompt injection, polyglot uploads, stored XSS, OOM mitigation, and data retention conflicts.
- **Zero-Cost Infrastructure Guide (`/docs/architecture/ZERO_COST_INFRASTRUCTURE.md`):** Audited free-tier limits, failure behaviors, and upgrade paths; unified Docker Compose stack for single free VM; Playwright single-concurrency queue with browser `window.print()` fallback; 3-mode AI abstraction (`disabled` default for MVP, BYOK, paid); automated encrypted `pg_dump` to Cloudflare R2 with tested restore procedure.
- **Architectural Decision Records (`/docs/adr/`):**
  - ADR-001: Technology Stack Selection: Modular Monolith (Next.js + NestJS + PostgreSQL + Drizzle)
  - ADR-002: Authentication Framework Selection: Better Auth
  - ADR-003: PDF Rendering Engine, Sandboxing & Client Fallback
  - ADR-004: AI Architecture: 3-Mode Provider Abstraction & Zero-Training Compliance
  - ADR-005: Zero-Cost Deployment Architecture & Encrypted Cloudflare R2 Backups
- **Commercial Open-Source License Registry (`/LICENSES`):** Open-licensed fonts (Noto Sans Arabic, Amiri, Inter, Roboto), icons (Lucide), and libraries verified with zero GPL/AGPL in shipped deliverables.
