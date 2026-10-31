-- =============================================================================
-- LINKME Platform — Drizzle Initial Migration Rollback (DOWN)
-- =============================================================================
-- Reverses packages/db/drizzle/0000_init.sql completely.
-- Drops all tables in reverse dependency order (child before parent)
-- to prevent foreign key constraint violations, followed by all enums.
-- =============================================================================

-- 1. Drop Tables (Reverse FK Dependency Order)
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "data_requests" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "plans" CASCADE;
DROP TABLE IF EXISTS "ai_credit_ledger" CASCADE;
DROP TABLE IF EXISTS "ai_jobs" CASCADE;
DROP TABLE IF EXISTS "import_jobs" CASCADE;
DROP TABLE IF EXISTS "export_jobs" CASCADE;
DROP TABLE IF EXISTS "link_views" CASCADE;
DROP TABLE IF EXISTS "share_links" CASCADE;
DROP TABLE IF EXISTS "ats_scores" CASCADE;
DROP TABLE IF EXISTS "resume_versions" CASCADE;
DROP TABLE IF EXISTS "resume_items" CASCADE;
DROP TABLE IF EXISTS "resume_sections" CASCADE;
DROP TABLE IF EXISTS "resumes" CASCADE;
DROP TABLE IF EXISTS "job_targets" CASCADE;
DROP TABLE IF EXISTS "templates" CASCADE;
DROP TABLE IF EXISTS "custom_values" CASCADE;
DROP TABLE IF EXISTS "custom_entries" CASCADE;
DROP TABLE IF EXISTS "custom_fields" CASCADE;
DROP TABLE IF EXISTS "custom_sections" CASCADE;
DROP TABLE IF EXISTS "documents" CASCADE;
DROP TABLE IF EXISTS "languages" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "skills" CASCADE;
DROP TABLE IF EXISTS "certifications" CASCADE;
DROP TABLE IF EXISTS "educations" CASCADE;
DROP TABLE IF EXISTS "experiences" CASCADE;
DROP TABLE IF EXISTS "profiles" CASCADE;
DROP TABLE IF EXISTS "media_assets" CASCADE;
DROP TABLE IF EXISTS "consent_records" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "auth_identities" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "two_factor" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- 2. Drop Custom Enums
DROP TYPE IF EXISTS "public"."scan_status_type";
DROP TYPE IF EXISTS "public"."plan_type";
DROP TYPE IF EXISTS "public"."subscription_status";
DROP TYPE IF EXISTS "public"."ai_job_kind";
DROP TYPE IF EXISTS "public"."job_status";
DROP TYPE IF EXISTS "public"."custom_field_type";
DROP TYPE IF EXISTS "public"."direction_type";
DROP TYPE IF EXISTS "public"."user_status";
DROP TYPE IF EXISTS "public"."user_role";
