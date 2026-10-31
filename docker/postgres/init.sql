-- =============================================================================
-- LINKME Platform - PostgreSQL Initialization Script
-- =============================================================================
-- This script runs ONCE when the PostgreSQL container is first created.
-- It enables required extensions for the linkme_db database.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypt(), gen_salt()

-- Note: uuid-ossp is NOT needed because pgcrypto provides gen_random_uuid()
-- which is the standard UUID v4 generator in PostgreSQL 13+.
