/**
 * LINKME Platform — Drizzle ORM Schema
 *
 * This file defines all PostgreSQL tables, enums, indexes, constraints,
 * and relations as specified in /docs/architecture/DATA_MODEL.md.
 *
 * Notes:
 * - Every table uses UUID v4 primary keys via gen_random_uuid().
 * - Field-level encryption (FLE) columns store AES-256-GCM ciphertext as text.
 * - JSONB columns use .$type<T>() for TypeScript type narrowing.
 * - Check constraints enforce domain rules at the database level.
 * - Deferrable unique constraints on position columns allow reordering.
 */

import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  unique,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// =============================================================================
// 1. Custom PostgreSQL Enums
// =============================================================================

export const userRoleEnum = pgEnum("user_role", [
  "VISITOR",
  "USER",
  "PREMIUM",
  "ADMIN",
]);

export const userStatusEnum = pgEnum("user_status", [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "PENDING_DELETION",
  "DELETED",
]);

export const directionTypeEnum = pgEnum("direction_type", ["ltr", "rtl"]);

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "date",
  "number",
  "url",
  "file",
  "list",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const aiJobKindEnum = pgEnum("ai_job_kind", [
  "tailor",
  "ats_score",
  "writing_assistant",
  "translate",
  "import_cv",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "expired",
]);

export const planTypeEnum = pgEnum("plan_type", [
  "free",
  "pro_monthly",
  "pro_annual",
  "short_term_pass",
  "credit_pack",
]);

export const scanStatusEnum = pgEnum("scan_status_type", [
  "pending",
  "clean",
  "infected",
  "error",
]);

// =============================================================================
// 2. USERS
// =============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    emailNormalized: varchar("email_normalized", {
      length: 255,
    }).generatedAlwaysAs(sql`lower(trim(email))`),
    passwordHash: varchar("password_hash", { length: 255 }),
    locale: varchar("locale", { length: 10 }).notNull().default("en"),
    // Age Gate (18+ mandatory, no date of birth collected)
    ageConfirmed: boolean("age_confirmed").notNull().default(false),
    ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
    agePolicyVersion: varchar("age_policy_version", { length: 32 })
      .notNull()
      .default("v1.0"),
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    twofaEnabled: boolean("twofa_enabled").notNull().default(false),
    twofaSecretEncrypted: text("twofa_secret_encrypted"),
    twofaRecoveryCodesHash: jsonb("twofa_recovery_codes_hash").$type<
      string[] | null
    >(),
    role: userRoleEnum("role").notNull().default("USER"),
    status: userStatusEnum("status").notNull().default("PENDING_VERIFICATION"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_users_email").on(table.emailNormalized),
    index("idx_users_status_deleted").on(table.status, table.deletedAt),
    check(
      "chk_age_confirmation",
      sql`(${table.ageConfirmed} = TRUE AND ${table.ageConfirmedAt} IS NOT NULL) OR (${table.ageConfirmed} = FALSE AND ${table.ageConfirmedAt} IS NULL)`,
    ),
  ],
);

// =============================================================================
// 3. AUTH_IDENTITIES (OAuth Accounts)
// =============================================================================

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_auth_provider").on(table.provider, table.providerUserId),
    index("idx_auth_identities_user").on(table.userId),
  ],
);

// =============================================================================
// 4. SESSIONS
// =============================================================================

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    deviceInfo: varchar("device_info", { length: 255 }),
    ipSubnet: varchar("ip_subnet", { length: 45 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sessions_user_active").on(table.userId, table.expiresAt),
    index("idx_sessions_token_hash").on(table.tokenHash),
  ],
);

// =============================================================================
// 5. CONSENT_RECORDS
// =============================================================================

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 64 }).notNull(),
    granted: boolean("granted").notNull(),
    policyVersion: varchar("policy_version", { length: 32 }).notNull(),
    ipSubnet: varchar("ip_subnet", { length: 45 }),
    userAgentCategory: varchar("user_agent_category", { length: 64 }),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_consent_records_user_purpose").on(
      table.userId,
      table.purpose,
      table.recordedAt,
    ),
  ],
);

// =============================================================================
// 6. MEDIA_ASSETS
// =============================================================================

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 512 }).notNull().unique(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256Hash: varchar("sha256_hash", { length: 64 }).notNull(),
    scanStatus: scanStatusEnum("scan_status").notNull().default("pending"),
    scanDetails: jsonb("scan_details").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_media_assets_user").on(table.userId)],
);

// =============================================================================
// 7. PROFILES (Master Profile)
// =============================================================================

export interface LinkItem {
  label: string;
  url: string;
}

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    headline: varchar("headline", { length: 255 }),
    bio: text("bio"),
    photoAssetId: uuid("photo_asset_id").references(
      (): AnyPgColumn => mediaAssets.id,
      { onDelete: "set null" },
    ),
    phoneEncrypted: text("phone_encrypted"),
    cityEncrypted: text("city_encrypted"),
    links: jsonb("links").$type<LinkItem[]>().notNull().default([]),
    optionalSensitiveFieldsEncrypted: text(
      "optional_sensitive_fields_encrypted",
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("uq_profiles_user").on(table.userId)],
);

// =============================================================================
// 8. PROFILE SUB-ENTITIES
// =============================================================================

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    company: varchar("company", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_experiences_profile_sort").on(table.profileId, table.sortOrder),
    check(
      "chk_experience_dates",
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

export const educations = pgTable(
  "educations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    institution: varchar("institution", { length: 255 }).notNull(),
    degree: varchar("degree", { length: 255 }).notNull(),
    fieldOfStudy: varchar("field_of_study", { length: 255 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_educations_profile_sort").on(table.profileId, table.sortOrder),
    check(
      "chk_education_dates",
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

export const certifications = pgTable(
  "certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    issuer: varchar("issuer", { length: 255 }).notNull(),
    issuedOn: date("issued_on").notNull(),
    expiresOn: date("expires_on"),
    credentialUrl: varchar("credential_url", { length: 512 }),
    proofAssetId: uuid("proof_asset_id").references(
      (): AnyPgColumn => mediaAssets.id,
      { onDelete: "set null" },
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_certifications_profile").on(table.profileId)],
);

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    level: varchar("level", { length: 64 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_skills_profile").on(table.profileId)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    url: varchar("url", { length: 512 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
);

export const languages = pgTable(
  "languages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    proficiency: varchar("proficiency", { length: 64 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
);

// =============================================================================
// 9. CUSTOM SECTIONS & SCHEMALESS EXTENSIONS
// =============================================================================

export const customSections = pgTable(
  "custom_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
);

export const customFields = pgTable(
  "custom_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => customSections.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 128 }).notNull(),
    fieldKey: varchar("field_key", { length: 64 }).notNull(),
    dataType: customFieldTypeEnum("data_type").notNull(),
    required: boolean("required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    unique("uq_custom_fields_section_key").on(table.sectionId, table.fieldKey),
  ],
);

export const customEntries = pgTable(
  "custom_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => customSections.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
);

export const customValues = pgTable(
  "custom_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => customEntries.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => customFields.id, { onDelete: "cascade" }),
    value: jsonb("value").notNull(),
  },
  (table) => [
    unique("uq_custom_values_entry_field").on(table.entryId, table.fieldId),
    // Note: GIN index on JSONB values is added in raw SQL migration
    // because drizzle-kit does not yet support GIN index syntax directly.
  ],
);

// =============================================================================
// 10. TEMPLATES
// =============================================================================

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 128 }).notNull().unique(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    layoutSchema: jsonb("layout_schema")
      .$type<Record<string, unknown>>()
      .notNull(),
    atsSafe: boolean("ats_safe").notNull().default(true),
    isPremium: boolean("is_premium").notNull().default(false),
    rtlSupported: boolean("rtl_supported").notNull().default(true),
    licenseInfo: varchar("license_info", { length: 255 })
      .notNull()
      .default("MIT / Proprietary In-House"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
);

// =============================================================================
// 11. JOB TARGETS
// =============================================================================

export const jobTargets = pgTable(
  "job_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    descriptionText: text("description_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_job_targets_user").on(table.userId)],
);

// =============================================================================
// 12. RESUMES & SECTIONS
// =============================================================================

export interface ResumeStyleSettings {
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  lineSpacing: number;
  margins: number;
}

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "restrict" }),
    jobTargetId: uuid("job_target_id").references(() => jobTargets.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    language: varchar("language", { length: 10 }).notNull().default("en"),
    direction: directionTypeEnum("direction").notNull().default("ltr"),
    styleSettings: jsonb("style_settings")
      .$type<ResumeStyleSettings>()
      .notNull()
      .default({
        fontFamily: "Inter",
        fontSize: 10,
        primaryColor: "#111827",
        lineSpacing: 1.4,
        margins: 20,
      }),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_resumes_user").on(table.userId)],
);

export const resumeSections = pgTable(
  "resume_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    sectionType: varchar("section_type", { length: 64 }).notNull(),
    titleOverride: varchar("title_override", { length: 255 }),
    position: integer("position").notNull(),
    visible: boolean("visible").notNull().default(true),
  },
  (table) => [
    // Note: DEFERRABLE INITIALLY DEFERRED is added via raw SQL in migration
    unique("uq_resume_sections_pos").on(table.resumeId, table.position),
    index("idx_resume_sections_resume").on(table.resumeId, table.position),
  ],
);

export const resumeItems = pgTable(
  "resume_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => resumeSections.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    overrides: jsonb("overrides")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    position: integer("position").notNull(),
    visible: boolean("visible").notNull().default(true),
  },
  (table) => [
    unique("uq_resume_items_pos").on(table.sectionId, table.position),
    index("idx_resume_items_section").on(table.sectionId, table.position),
  ],
);

// =============================================================================
// 13. RESUME VERSIONS
// =============================================================================

export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    name: varchar("name", { length: 255 }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_resume_version_num").on(table.resumeId, table.versionNumber),
  ],
);

// =============================================================================
// 14. ATS SCORES
// =============================================================================

export const atsScores = pgTable(
  "ats_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ats_scores_resume").on(table.resumeId, table.createdAt),
    check(
      "chk_ats_score_range",
      sql`${table.score} >= 0 AND ${table.score} <= 100`,
    ),
  ],
);

// =============================================================================
// 15. SHARE LINKS & LINK_VIEWS
// =============================================================================

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    isPublic: boolean("is_public").notNull().default(true),
    passwordHash: varchar("password_hash", { length: 255 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_share_links_lookup").on(table.slug)],
);

// Note: link_views uses PostgreSQL range partitioning by viewed_at.
// Drizzle does not natively support PARTITION BY RANGE.
// This table is defined as a normal table here; the migration SQL
// will be manually edited to add partitioning.
// For Phase 1, we define it as a regular table. Partitioning will
// be added in the migration SQL and tested.
export const linkViews = pgTable(
  "link_views",
  {
    id: uuid("id").defaultRandom().notNull(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => shareLinks.id, { onDelete: "cascade" }),
    countryCode: varchar("country_code", { length: 2 }),
    deviceType: varchar("device_type", { length: 32 }),
    referrerDomain: varchar("referrer_domain", { length: 255 }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_link_views_link_date").on(table.linkId, table.viewedAt),
  ],
);

// =============================================================================
// 16. JOBS PIPELINE (EXPORT, IMPORT, AI)
// =============================================================================

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    format: varchar("format", { length: 10 }).notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    outputAssetId: uuid("output_asset_id").references(
      (): AnyPgColumn => mediaAssets.id,
      { onDelete: "set null" },
    ),
    errorMessage: text("error_message"),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW() + INTERVAL '24 hours'`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_export_jobs_user").on(table.userId, table.createdAt)],
);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    status: jobStatusEnum("status").notNull().default("queued"),
    parsedResult: jsonb("parsed_result").$type<Record<
      string,
      unknown
    > | null>(),
    reviewedByUser: boolean("reviewed_by_user").notNull().default(false),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_import_jobs_user").on(table.userId)],
);

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: aiJobKindEnum("kind").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    model: varchar("model", { length: 64 }).notNull(),
    tokensPrompt: integer("tokens_prompt").notNull().default(0),
    tokensCompletion: integer("tokens_completion").notNull().default(0),
    costCents: numeric("cost_cents", { precision: 10, scale: 4 })
      .notNull()
      .default("0.0000"),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_ai_jobs_user").on(table.userId, table.createdAt)],
);

export const aiCreditLedger = pgTable(
  "ai_credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: varchar("reason", { length: 64 }).notNull(),
    aiJobId: uuid("ai_job_id").references(() => aiJobs.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ai_credit_ledger_user").on(table.userId, table.createdAt),
  ],
);

// =============================================================================
// 17. BILLING & PLANS (Dormant in MVP — FEATURE_BILLING_ENABLED=false)
// =============================================================================

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    type: planTypeEnum("type").notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    limits: jsonb("limits")
      .$type<{
        maxResumes: number;
        aiCreditsPerMonth: number;
        exportFormats: string[];
      }>()
      .notNull(),
    regionalPrices: jsonb("regional_prices")
      .$type<Record<string, number>>()
      .notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerSubscriptionId: varchar("provider_subscription_id", {
      length: 255,
    })
      .notNull()
      .unique(),
    providerCustomerId: varchar("provider_customer_id", {
      length: 255,
    }).notNull(),
    renewsAt: timestamp("renews_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_subscriptions_user").on(table.userId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    providerPaymentId: varchar("provider_payment_id", { length: 255 })
      .notNull()
      .unique(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    invoiceUrl: varchar("invoice_url", { length: 512 }),
    taxCountryCode: varchar("tax_country_code", { length: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_payments_user").on(table.userId)],
);

// =============================================================================
// 18. PRIVACY REQUESTS & AUDIT LOG
// =============================================================================

export const dataRequests = pgTable(
  "data_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    notes: text("notes"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW() + INTERVAL '30 days'`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("idx_data_requests_due").on(table.status, table.dueAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: varchar("actor_role", { length: 32 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: uuid("target_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ipSubnet: varchar("ip_subnet", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_actor").on(table.actorId, table.createdAt),
    index("idx_audit_logs_action").on(table.action, table.createdAt),
  ],
);

// =============================================================================
// 19. DRIZZLE RELATIONS (for type-safe query builder)
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  authIdentities: many(authIdentities),
  sessions: many(sessions),
  consentRecords: many(consentRecords),
  mediaAssets: many(mediaAssets),
  resumes: many(resumes),
  jobTargets: many(jobTargets),
  exportJobs: many(exportJobs),
  importJobs: many(importJobs),
  aiJobs: many(aiJobs),
  aiCreditLedger: many(aiCreditLedger),
  subscriptions: many(subscriptions),
  payments: many(payments),
  dataRequests: many(dataRequests),
  auditLogs: many(auditLogs),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  photoAsset: one(mediaAssets, {
    fields: [profiles.photoAssetId],
    references: [mediaAssets.id],
  }),
  experiences: many(experiences),
  educations: many(educations),
  certifications: many(certifications),
  skills: many(skills),
  projects: many(projects),
  languages: many(languages),
  documents: many(documents),
  customSections: many(customSections),
}));

export const experiencesRelations = relations(experiences, ({ one }) => ({
  profile: one(profiles, {
    fields: [experiences.profileId],
    references: [profiles.id],
  }),
}));

export const educationsRelations = relations(educations, ({ one }) => ({
  profile: one(profiles, {
    fields: [educations.profileId],
    references: [profiles.id],
  }),
}));

export const certificationsRelations = relations(certifications, ({ one }) => ({
  profile: one(profiles, {
    fields: [certifications.profileId],
    references: [profiles.id],
  }),
  proofAsset: one(mediaAssets, {
    fields: [certifications.proofAssetId],
    references: [mediaAssets.id],
  }),
}));

export const resumesRelations = relations(resumes, ({ one, many }) => ({
  user: one(users, {
    fields: [resumes.userId],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [resumes.templateId],
    references: [templates.id],
  }),
  jobTarget: one(jobTargets, {
    fields: [resumes.jobTargetId],
    references: [jobTargets.id],
  }),
  sections: many(resumeSections),
  versions: many(resumeVersions),
  atsScores: many(atsScores),
  shareLinks: many(shareLinks),
  exportJobs: many(exportJobs),
}));

export const resumeSectionsRelations = relations(
  resumeSections,
  ({ one, many }) => ({
    resume: one(resumes, {
      fields: [resumeSections.resumeId],
      references: [resumes.id],
    }),
    items: many(resumeItems),
  }),
);

export const resumeItemsRelations = relations(resumeItems, ({ one }) => ({
  section: one(resumeSections, {
    fields: [resumeItems.sectionId],
    references: [resumeSections.id],
  }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one, many }) => ({
  resume: one(resumes, {
    fields: [shareLinks.resumeId],
    references: [resumes.id],
  }),
  views: many(linkViews),
}));

export const linkViewsRelations = relations(linkViews, ({ one }) => ({
  shareLink: one(shareLinks, {
    fields: [linkViews.linkId],
    references: [shareLinks.id],
  }),
}));
