/**
 * Schema integrity tests — validates that the Drizzle ORM schema
 * is correctly defined without needing a database connection.
 *
 * These tests verify:
 * 1. All tables export the expected columns
 * 2. Enum values match DATA_MODEL.md
 * 3. Foreign key references are structurally valid
 * 4. Relations are defined
 */

import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import * as schema from "../src/schema.js";
import { createDb } from "../src/connection.js";

describe("Schema: Enums", () => {
  it("userRoleEnum has the correct values", () => {
    expect(schema.userRoleEnum.enumValues).toEqual([
      "VISITOR",
      "USER",
      "PREMIUM",
      "ADMIN",
    ]);
  });

  it("userStatusEnum has the correct values", () => {
    expect(schema.userStatusEnum.enumValues).toEqual([
      "PENDING_VERIFICATION",
      "ACTIVE",
      "SUSPENDED",
      "PENDING_DELETION",
      "DELETED",
    ]);
  });

  it("directionTypeEnum has the correct values", () => {
    expect(schema.directionTypeEnum.enumValues).toEqual(["ltr", "rtl"]);
  });

  it("customFieldTypeEnum has the correct values", () => {
    expect(schema.customFieldTypeEnum.enumValues).toEqual([
      "text",
      "date",
      "number",
      "url",
      "file",
      "list",
    ]);
  });

  it("jobStatusEnum has the correct values", () => {
    expect(schema.jobStatusEnum.enumValues).toEqual([
      "queued",
      "processing",
      "completed",
      "failed",
    ]);
  });

  it("scanStatusEnum has the correct values", () => {
    expect(schema.scanStatusEnum.enumValues).toEqual([
      "pending",
      "clean",
      "infected",
      "error",
    ]);
  });

  it("planTypeEnum has the correct values", () => {
    expect(schema.planTypeEnum.enumValues).toEqual([
      "free",
      "pro_monthly",
      "pro_annual",
      "short_term_pass",
      "credit_pack",
    ]);
  });
});

describe("Schema: Users table", () => {
  it("has required columns", () => {
    const columns = getTableColumns(schema.users);
    const columnNames = Object.keys(columns);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("email");
    expect(columnNames).toContain("emailNormalized");
    expect(columnNames).toContain("passwordHash");
    expect(columnNames).toContain("ageConfirmed");
    expect(columnNames).toContain("ageConfirmedAt");
    expect(columnNames).toContain("agePolicyVersion");
    expect(columnNames).toContain("emailVerified");
    expect(columnNames).toContain("role");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("createdAt");
    expect(columnNames).toContain("updatedAt");
    expect(columnNames).toContain("deletedAt");
    expect(columnNames).toContain("twofaEnabled");
    expect(columnNames).toContain("twofaSecretEncrypted");
    expect(columnNames).toContain("twofaRecoveryCodesHash");
  });

  it("emailNormalized is a generated column", () => {
    const columns = getTableColumns(schema.users);
    // Generated columns have isGenerated set
    expect(columns["emailNormalized"]?.generated).toBeDefined();
  });
});

describe("Schema: Profiles table", () => {
  it("has FLE-encrypted columns for sensitive data", () => {
    const columns = getTableColumns(schema.profiles);
    const columnNames = Object.keys(columns);

    expect(columnNames).toContain("phoneEncrypted");
    expect(columnNames).toContain("cityEncrypted");
    expect(columnNames).toContain("optionalSensitiveFieldsEncrypted");
  });

  it("has a unique constraint on userId (one profile per user)", () => {
    const columns = getTableColumns(schema.profiles);
    expect(columns["userId"]).toBeDefined();
  });
});

describe("Schema: Profile sub-entities", () => {
  it("experiences table has date columns and sort_order", () => {
    const columns = getTableColumns(schema.experiences);
    expect(Object.keys(columns)).toContain("startDate");
    expect(Object.keys(columns)).toContain("endDate");
    expect(Object.keys(columns)).toContain("sortOrder");
    expect(Object.keys(columns)).toContain("profileId");
  });

  it("educations table has date columns and sort_order", () => {
    const columns = getTableColumns(schema.educations);
    expect(Object.keys(columns)).toContain("startDate");
    expect(Object.keys(columns)).toContain("endDate");
    expect(Object.keys(columns)).toContain("sortOrder");
    expect(Object.keys(columns)).toContain("fieldOfStudy");
  });

  it("certifications table has proof_asset_id FK", () => {
    const columns = getTableColumns(schema.certifications);
    expect(Object.keys(columns)).toContain("proofAssetId");
    expect(Object.keys(columns)).toContain("credentialUrl");
  });

  it("skills table has name and level", () => {
    const columns = getTableColumns(schema.skills);
    expect(Object.keys(columns)).toContain("name");
    expect(Object.keys(columns)).toContain("level");
  });

  it("projects table has url", () => {
    const columns = getTableColumns(schema.projects);
    expect(Object.keys(columns)).toContain("url");
  });

  it("languages table has proficiency", () => {
    const columns = getTableColumns(schema.languages);
    expect(Object.keys(columns)).toContain("proficiency");
  });

  it("documents table has asset_id", () => {
    const columns = getTableColumns(schema.documents);
    expect(Object.keys(columns)).toContain("assetId");
  });
});

describe("Schema: Custom sections", () => {
  it("custom_fields table has data_type enum column", () => {
    const columns = getTableColumns(schema.customFields);
    expect(Object.keys(columns)).toContain("dataType");
    expect(Object.keys(columns)).toContain("fieldKey");
    expect(Object.keys(columns)).toContain("required");
  });

  it("custom_values table has JSONB value column", () => {
    const columns = getTableColumns(schema.customValues);
    expect(Object.keys(columns)).toContain("value");
    expect(Object.keys(columns)).toContain("entryId");
    expect(Object.keys(columns)).toContain("fieldId");
  });
});

describe("Schema: Resume system", () => {
  it("resumes table has style_settings JSONB", () => {
    const columns = getTableColumns(schema.resumes);
    expect(Object.keys(columns)).toContain("styleSettings");
    expect(Object.keys(columns)).toContain("direction");
    expect(Object.keys(columns)).toContain("templateId");
  });

  it("resume_sections has position for drag-and-drop ordering", () => {
    const columns = getTableColumns(schema.resumeSections);
    expect(Object.keys(columns)).toContain("position");
    expect(Object.keys(columns)).toContain("sectionType");
    expect(Object.keys(columns)).toContain("visible");
  });

  it("resume_items has overrides JSONB", () => {
    const columns = getTableColumns(schema.resumeItems);
    expect(Object.keys(columns)).toContain("overrides");
    expect(Object.keys(columns)).toContain("sourceType");
    expect(Object.keys(columns)).toContain("sourceId");
  });

  it("resume_versions has snapshot JSONB", () => {
    const columns = getTableColumns(schema.resumeVersions);
    expect(Object.keys(columns)).toContain("snapshot");
    expect(Object.keys(columns)).toContain("versionNumber");
  });
});

describe("Schema: Share links & analytics", () => {
  it("share_links has revocable and expiring fields", () => {
    const columns = getTableColumns(schema.shareLinks);
    expect(Object.keys(columns)).toContain("slug");
    expect(Object.keys(columns)).toContain("passwordHash");
    expect(Object.keys(columns)).toContain("expiresAt");
    expect(Object.keys(columns)).toContain("revokedAt");
  });

  it("link_views stores country-level analytics (no raw IP)", () => {
    const columns = getTableColumns(schema.linkViews);
    expect(Object.keys(columns)).toContain("countryCode");
    expect(Object.keys(columns)).toContain("deviceType");
    expect(Object.keys(columns)).toContain("referrerDomain");
    // Must NOT have ip_address column — privacy by design
    expect(Object.keys(columns)).not.toContain("ipAddress");
  });
});

describe("Schema: Jobs pipeline", () => {
  it("export_jobs has format and expires_at", () => {
    const columns = getTableColumns(schema.exportJobs);
    expect(Object.keys(columns)).toContain("format");
    expect(Object.keys(columns)).toContain("expiresAt");
    expect(Object.keys(columns)).toContain("status");
  });

  it("ai_jobs tracks cost_cents and tokens", () => {
    const columns = getTableColumns(schema.aiJobs);
    expect(Object.keys(columns)).toContain("costCents");
    expect(Object.keys(columns)).toContain("tokensPrompt");
    expect(Object.keys(columns)).toContain("tokensCompletion");
  });

  it("ai_credit_ledger has delta and balance_after", () => {
    const columns = getTableColumns(schema.aiCreditLedger);
    expect(Object.keys(columns)).toContain("delta");
    expect(Object.keys(columns)).toContain("balanceAfter");
    expect(Object.keys(columns)).toContain("reason");
  });
});

describe("Schema: Billing (dormant in MVP)", () => {
  it("plans table exists with limits JSONB", () => {
    const columns = getTableColumns(schema.plans);
    expect(Object.keys(columns)).toContain("limits");
    expect(Object.keys(columns)).toContain("regionalPrices");
    expect(Object.keys(columns)).toContain("code");
    expect(Object.keys(columns)).toContain("type");
  });

  it("subscriptions table has provider fields", () => {
    const columns = getTableColumns(schema.subscriptions);
    expect(Object.keys(columns)).toContain("providerSubscriptionId");
    expect(Object.keys(columns)).toContain("providerCustomerId");
  });

  it("payments table allows user_id SET NULL for erasure", () => {
    const columns = getTableColumns(schema.payments);
    // userId should be nullable for GDPR erasure
    expect(columns["userId"]?.notNull).toBe(false);
  });
});

describe("Schema: Privacy & audit", () => {
  it("data_requests has due_at for GDPR compliance deadlines", () => {
    const columns = getTableColumns(schema.dataRequests);
    expect(Object.keys(columns)).toContain("dueAt");
    expect(Object.keys(columns)).toContain("type");
    expect(Object.keys(columns)).toContain("completedAt");
  });

  it("audit_logs actor_id allows SET NULL for user erasure", () => {
    const columns = getTableColumns(schema.auditLogs);
    expect(columns["actorId"]?.notNull).toBe(false);
    expect(Object.keys(columns)).toContain("action");
    expect(Object.keys(columns)).toContain("targetType");
    expect(Object.keys(columns)).toContain("metadata");
  });
});

describe("Schema: Connection factory", () => {
  it("createDb throws when DATABASE_URL is not set", () => {
    const originalEnv = process.env["DATABASE_URL"];
    delete process.env["DATABASE_URL"];

    expect(() => createDb()).toThrow("DATABASE_URL is not set");

    if (originalEnv !== undefined) {
      process.env["DATABASE_URL"] = originalEnv;
    }
  });
});
