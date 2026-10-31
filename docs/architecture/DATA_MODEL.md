# Data Model & Relational Schema Specification

**Document Version:** 1.0.0-draft  
**Status:** Under Review (Phase 0)  
**Authors:** Senior Staff Engineer, Security & Privacy Engineering

---

## 1. Critical Review of Starting ERD & Proposed Improvements

The starting ERD provides a strong foundational entity map. A production-grade security, privacy, and scale review identifies the following architectural enhancements:

### 1.1 Field-Level Encryption (FLE) for Sensitive Profile Attributes

- **Issue in Starting ERD:** `PROFILES.phone`, `PROFILES.city`, and `PROFILES.optional_sensitive_fields` are stored in plaintext. If the database volume is compromised or backed up, sensitive PII (including age, gender, marital status, nationality) is exposed.
- **Improvement:** Implement application-layer Authenticated AES-256-GCM encryption with envelope encryption.
  - Add `phone_encrypted text`, `city_encrypted text`, and `optional_sensitive_fields_encrypted text` with an initialization vector and authentication tag.
  - Decryption happens exclusively in-memory on the application server when an authorized owner accesses the profile.

### 1.2 Table Partitioning for High-Volume Analytics (`LINK_VIEWS`)

- **Issue in Starting ERD:** `LINK_VIEWS` records a row for every public resume view. For viral share links, this table will grow rapidly to tens of millions of rows, degrading query performance and bloating B-tree indexes.
- **Improvement:** Partition `LINK_VIEWS` using **PostgreSQL Declarative Range Partitioning** by `viewed_at` (monthly partitions: `link_views_y2026m10`, `link_views_y2026m11`, etc.).
  - Enables instant drop of old partitions in compliance with the data retention policy (e.g., automated pruning after 180 days).
  - Keeps active indexes small and entirely in RAM.

### 1.3 Privacy-First Analytics Redaction (No Raw IP Storage)

- **Issue in Starting ERD:** Storing raw IP addresses or detailed user agents in view logs violates data minimization under GDPR (Recital 49, Article 5(1)(c)) and Lebanese Law 81/2018.
- **Improvement:** Ingress reverse proxy resolves ISO 3166-1 alpha-2 country code (`country_code`) and general device class (`desktop`, `mobile`, `tablet`). The raw IP address is discarded immediately in RAM and never written to PostgreSQL.

### 1.4 Soft-Delete vs. Right-to-be-Forgotten Erasure Cascades (UC-05)

- **Issue in Starting ERD:** Naive soft-delete (`deleted_at`) retains all personal data indefinitely in the database, violating GDPR Article 17 (Right to Erasure) and CCPA § 1798.105.
- **Improvement:** Implement a two-stage erasure lifecycle:
  1. **Stage 1 (Soft Delete & 7-Day Grace Period):** `status = 'pending_deletion'`, `deleted_at = NOW()`. User can self-service cancel within 7 days.
  2. **Stage 2 (Cryptographic Erasure / Hard Purge):**
     - Cascading `DELETE` across `PROFILES`, `EXPERIENCES`, `EDUCATIONS`, `CERTIFICATIONS`, `SKILLS`, `PROJECTS`, `LANGUAGES`, `DOCUMENTS`, `CUSTOM_*`, `RESUMES`, `RESUME_*`, `SHARE_LINKS`, `LINK_VIEWS`, `AI_JOBS`, `IMPORT_JOBS`.
     - Deletion requests sent to S3/R2 to purge all `MEDIA_ASSETS` and exported files.
     - Revocation of all Redis sessions and BullMQ jobs.
     - **Audit Logs Anonymization:** `AUDIT_LOGS.actor_id` set to `NULL`, metadata scrubbed of email/identifiers.
     - **Payments Legal Retention (Commercial & Tax Law):** Under European/UK tax directives (VAT Directive 2006/112/EC) and Lebanese Code of Commerce, transaction invoices must be preserved for 7 to 10 years. In `PAYMENTS`, `user_id` is unlinked or replaced with a pseudonymous tax-tombstone identifier; all personal profile details are permanently purged.

### 1.5 Strict Foreign Keys, Check Constraints & Ordering

- Add database-level check constraints:
  - `CHECK (end_date >= start_date OR end_date IS NULL)` on `EXPERIENCES` and `EDUCATIONS`.
  - `CHECK (position >= 0)` on `RESUME_SECTIONS` and `RESUME_ITEMS`.
  - `CHECK (score >= 0 AND score <= 100)` on `ATS_SCORES`.
  - `UNIQUE (resume_id, position) DEFERRABLE INITIALLY DEFERRED` to prevent race conditions during drag-and-drop reordering.
  - `UNIQUE (section_id, position) DEFERRABLE INITIALLY DEFERRED` on `RESUME_ITEMS`.

---

## 2. Comprehensive Relational Schema Definition (PostgreSQL 16 DDL & Types)

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Enums
CREATE TYPE user_role AS ENUM ('VISITOR', 'USER', 'PREMIUM', 'ADMIN');
CREATE TYPE user_status AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'PENDING_DELETION', 'DELETED');
CREATE TYPE direction_type AS ENUM ('ltr', 'rtl');
CREATE TYPE custom_field_type AS ENUM ('text', 'date', 'number', 'url', 'file', 'list');
CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed');
CREATE TYPE ai_job_kind AS ENUM ('tailor', 'ats_score', 'writing_assistant', 'translate', 'import_cv');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'expired');
CREATE TYPE plan_type AS ENUM ('free', 'pro_monthly', 'pro_annual', 'short_term_pass', 'credit_pack');
CREATE TYPE scan_status_type AS ENUM ('pending', 'clean', 'infected', 'error');

-- 1. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    email_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
    password_hash VARCHAR(255) NULL, -- NULL for OAuth-only users
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    -- Age Gate (18+ Mandatory, No Date of Birth)
    age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    age_confirmed_at TIMESTAMPTZ NULL,
    age_policy_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ NULL,
    twofa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    twofa_secret_encrypted TEXT NULL,
    twofa_recovery_codes_hash JSONB NULL,
    role user_role NOT NULL DEFAULT 'USER',
    status user_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_users_email UNIQUE (email_normalized),
    CONSTRAINT chk_age_confirmation CHECK (
        (age_confirmed = TRUE AND age_confirmed_at IS NOT NULL) OR
        (age_confirmed = FALSE AND age_confirmed_at IS NULL)
    )
);
CREATE INDEX idx_users_status_deleted ON users(status, deleted_at);

-- 2. AUTH_IDENTITIES (OAuth Accounts)
CREATE TABLE auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL, -- 'google', 'linkedin'
    provider_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_provider UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_auth_identities_user ON auth_identities(user_id);

-- 3. SESSIONS
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    device_info VARCHAR(255) NULL,
    ip_subnet VARCHAR(45) NULL, -- e.g. 192.168.1.0/24 or 2001:db8::/64 (anonymized)
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);

-- 4. CONSENT_RECORDS (Granular GDPR/ePrivacy tracking)
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(64) NOT NULL, -- 'essential_cookies', 'analytics_cookies', 'ai_processing', 'marketing_emails'
    granted BOOLEAN NOT NULL,
    policy_version VARCHAR(32) NOT NULL,
    ip_subnet VARCHAR(45) NULL,
    user_agent_category VARCHAR(64) NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_consent_records_user_purpose ON consent_records(user_id, purpose, recorded_at DESC);

-- 5. MEDIA_ASSETS (Quarantined and Scanned Objects)
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key VARCHAR(512) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    scan_status scan_status_type NOT NULL DEFAULT 'pending',
    scan_details JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_media_assets_user ON media_assets(user_id);

-- 6. PROFILES (Master Profile - Single Source of Truth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    headline VARCHAR(255) NULL,
    bio TEXT NULL,
    photo_asset_id UUID NULL REFERENCES media_assets(id) ON DELETE SET NULL,
    phone_encrypted TEXT NULL,
    city_encrypted TEXT NULL,
    links JSONB NOT NULL DEFAULT '[]', -- Array of { label: string, url: string }
    optional_sensitive_fields_encrypted TEXT NULL, -- Encrypted JSON payload: age, gender, marital_status, nationality
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_profiles_user UNIQUE (user_id)
);

-- 7. PROFILE SUB-ENTITIES
CREATE TABLE experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    company VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255) NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL, -- NULL indicates current
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_experience_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_experiences_profile_sort ON experiences(profile_id, sort_order);

CREATE TABLE educations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    institution VARCHAR(255) NOT NULL,
    degree VARCHAR(255) NOT NULL,
    field_of_study VARCHAR(255) NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_education_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_educations_profile_sort ON educations(profile_id, sort_order);

CREATE TABLE certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    issued_on DATE NOT NULL,
    expires_on DATE NULL,
    credential_url VARCHAR(512) NULL,
    proof_asset_id UUID NULL REFERENCES media_assets(id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_certifications_profile ON certifications(profile_id);

CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    level VARCHAR(64) NULL, -- 'Beginner', 'Intermediate', 'Advanced', 'Expert'
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_skills_profile ON skills(profile_id);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    url VARCHAR(512) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    proficiency VARCHAR(64) NOT NULL, -- e.g. Native, Fluent, C1, B2
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CUSTOM SECTIONS & SCHEMALESS EXTENSIONS
CREATE TABLE custom_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES custom_sections(id) ON DELETE CASCADE,
    label VARCHAR(128) NOT NULL,
    field_key VARCHAR(64) NOT NULL,
    data_type custom_field_type NOT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_custom_fields_section_key UNIQUE (section_id, field_key)
);

CREATE TABLE custom_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES custom_sections(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE custom_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES custom_entries(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    CONSTRAINT uq_custom_values_entry_field UNIQUE (entry_id, field_id)
);
CREATE INDEX idx_custom_values_gin ON custom_values USING gin(value);

-- 9. TEMPLATES
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL UNIQUE,
    slug VARCHAR(128) NOT NULL UNIQUE,
    layout_schema JSONB NOT NULL,
    ats_safe BOOLEAN NOT NULL DEFAULT TRUE,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    rtl_supported BOOLEAN NOT NULL DEFAULT TRUE,
    license_info VARCHAR(255) NOT NULL DEFAULT 'MIT / Proprietary In-House',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. JOB TARGETS
CREATE TABLE job_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NULL,
    description_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_job_targets_user ON job_targets(user_id);

-- 11. RESUMES & SECTIONS
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    job_target_id UUID NULL REFERENCES job_targets(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    direction direction_type NOT NULL DEFAULT 'ltr',
    style_settings JSONB NOT NULL DEFAULT '{"fontFamily": "Inter", "fontSize": 10, "primaryColor": "#111827", "lineSpacing": 1.4, "margins": 20}',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_resumes_user ON resumes(user_id);

CREATE TABLE resume_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    section_type VARCHAR(64) NOT NULL, -- 'summary', 'experience', 'education', 'skills', 'custom'
    title_override VARCHAR(255) NULL,
    position INT NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_resume_sections_pos UNIQUE (resume_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX idx_resume_sections_resume ON resume_sections(resume_id, position);

CREATE TABLE resume_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES resume_sections(id) ON DELETE CASCADE,
    source_type VARCHAR(64) NOT NULL, -- 'experience', 'education', 'skill', 'custom_entry'
    source_id UUID NOT NULL,
    overrides JSONB NOT NULL DEFAULT '{}', -- Per-resume modifications without mutating master record
    position INT NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_resume_items_pos UNIQUE (section_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX idx_resume_items_section ON resume_items(section_id, position);

-- 12. RESUME VERSIONS
CREATE TABLE resume_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    name VARCHAR(255) NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_resume_version_num UNIQUE (resume_id, version_number)
);

-- 13. ATS SCORES
CREATE TABLE ats_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    score INT NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ats_score_range CHECK (score >= 0 AND score <= 100)
);
CREATE INDEX idx_ats_scores_resume ON ats_scores(resume_id, created_at DESC);

-- 14. SHARE LINKS & PARTITIONED LINK_VIEWS
CREATE TABLE share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    slug VARCHAR(64) NOT NULL UNIQUE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    password_hash VARCHAR(255) NULL,
    expires_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_share_links_lookup ON share_links(slug) WHERE revoked_at IS NULL;

-- Partitioned Table: LINK_VIEWS
CREATE TABLE link_views (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
    country_code VARCHAR(2) NULL, -- ISO 3166-1 alpha-2, NO IP stored
    device_type VARCHAR(32) NULL, -- 'desktop', 'mobile', 'tablet'
    referrer_domain VARCHAR(255) NULL,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, viewed_at)
) PARTITION BY RANGE (viewed_at);

-- Initial Monthly Partitions
CREATE TABLE link_views_y2026m10 PARTITION OF link_views
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE link_views_y2026m11 PARTITION OF link_views
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE link_views_default PARTITION OF link_views DEFAULT;

CREATE INDEX idx_link_views_link_date ON link_views(link_id, viewed_at DESC);

-- 15. JOBS PIPELINE (EXPORT, IMPORT, AI)
CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    format VARCHAR(10) NOT NULL, -- 'pdf', 'docx', 'txt'
    status job_status NOT NULL DEFAULT 'queued',
    output_asset_id UUID NULL REFERENCES media_assets(id) ON DELETE SET NULL,
    error_message TEXT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_export_jobs_user ON export_jobs(user_id, created_at DESC);

CREATE TABLE import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
    status job_status NOT NULL DEFAULT 'queued',
    parsed_result JSONB NULL,
    reviewed_by_user BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_import_jobs_user ON import_jobs(user_id);

CREATE TABLE ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind ai_job_kind NOT NULL,
    status job_status NOT NULL DEFAULT 'queued',
    model VARCHAR(64) NOT NULL,
    tokens_prompt INT NOT NULL DEFAULT 0,
    tokens_completion INT NOT NULL DEFAULT 0,
    cost_cents NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    result JSONB NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_jobs_user ON ai_jobs(user_id, created_at DESC);

CREATE TABLE ai_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INT NOT NULL, -- negative for spend, positive for purchase/grant
    balance_after INT NOT NULL,
    reason VARCHAR(64) NOT NULL, -- 'signup_grant', 'monthly_allowance', 'pack_purchase', 'cv_import', 'ats_check'
    ai_job_id UUID NULL REFERENCES ai_jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_credit_ledger_user ON ai_credit_ledger(user_id, created_at DESC);

-- 16. BILLING & PLANS
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) NOT NULL UNIQUE,
    type plan_type NOT NULL,
    name VARCHAR(128) NOT NULL,
    limits JSONB NOT NULL, -- { maxResumes: number, aiCreditsPerMonth: number, exportFormats: string[] }
    regional_prices JSONB NOT NULL, -- { "USD": 1200, "EUR": 1100, "LBP": 1080000 }
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    status subscription_status NOT NULL DEFAULT 'active',
    provider VARCHAR(32) NOT NULL, -- 'stripe', 'lemonsqueezy', 'paddle'
    provider_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    provider_customer_id VARCHAR(255) NOT NULL,
    renews_at TIMESTAMPTZ NULL,
    canceled_at TIMESTAMPTZ NULL,
    ends_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL, -- SET NULL for erasure retention
    subscription_id UUID NULL REFERENCES subscriptions(id) ON DELETE SET NULL,
    provider_payment_id VARCHAR(255) NOT NULL UNIQUE,
    amount_minor INT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL,
    invoice_url VARCHAR(512) NULL,
    tax_country_code VARCHAR(2) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_user ON payments(user_id);

-- 17. PRIVACY REQUESTS & AUDIT LOG
CREATE TABLE data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL, -- 'export_full', 'erasure', 'ai_objection'
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected'
    notes TEXT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    completed_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_data_requests_due ON data_requests(status, due_at);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id UUID NULL,
    metadata JSONB NOT NULL DEFAULT '{}', -- Scrubbed of all PII
    ip_subnet VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
```
