import { describe, it, expect } from "vitest";
import {
  CustomFieldValueValidator,
  CreateCustomFieldSchema,
} from "../../src/profile/custom-section.validator.js";

describe("UC-09: Schemaless Custom Sections & Dynamic Field Validation", () => {
  it("validates custom field definition schema", () => {
    const validField = {
      sectionId: "123e4567-e89b-12d3-a456-426614174000",
      label: "Security Clearance",
      fieldKey: "security_clearance",
      dataType: "text" as const,
      required: false,
      sortOrder: 1,
    };

    const parsed = CreateCustomFieldSchema.safeParse(validField);
    expect(parsed.success).toBe(true);
  });

  it("rejects field keys with invalid characters", () => {
    const invalidField = {
      sectionId: "123e4567-e89b-12d3-a456-426614174000",
      label: "Invalid Key",
      fieldKey: "Not-Valid-Key!",
      dataType: "text" as const,
    };

    const parsed = CreateCustomFieldSchema.safeParse(invalidField);
    expect(parsed.success).toBe(false);
  });

  it("validates text type: accepts strings, rejects non-strings, enforces max length", () => {
    expect(
      CustomFieldValueValidator.validateValue("text", "Software Architect")
        .valid,
    ).toBe(true);
    expect(CustomFieldValueValidator.validateValue("text", 12345).valid).toBe(
      false,
    );
    expect(
      CustomFieldValueValidator.validateValue("text", "a".repeat(5001)).valid,
    ).toBe(false);
  });

  it("validates date type: accepts YYYY-MM-DD, rejects other formats", () => {
    expect(
      CustomFieldValueValidator.validateValue("date", "2026-10-30").valid,
    ).toBe(true);
    expect(
      CustomFieldValueValidator.validateValue("date", "30/10/2026").valid,
    ).toBe(false);
  });

  it("validates number type: accepts numbers, rejects NaN and strings", () => {
    expect(CustomFieldValueValidator.validateValue("number", 42).valid).toBe(
      true,
    );
    expect(CustomFieldValueValidator.validateValue("number", NaN).valid).toBe(
      false,
    );
    expect(
      CustomFieldValueValidator.validateValue("number", "not-a-number").valid,
    ).toBe(false);
  });

  it("validates url type: accepts valid URLs, rejects non-string and invalid URLs", () => {
    expect(
      CustomFieldValueValidator.validateValue(
        "url",
        "https://github.com/example",
      ).valid,
    ).toBe(true);
    // Non-string input (line 64 branch: typeof value !== 'string')
    expect(CustomFieldValueValidator.validateValue("url", 12345).valid).toBe(
      false,
    );
    expect(CustomFieldValueValidator.validateValue("url", 12345).error).toBe(
      "Expected URL string",
    );
    // Invalid URL string (catch branch)
    expect(
      CustomFieldValueValidator.validateValue("url", "not-a-valid-url").valid,
    ).toBe(false);
    expect(
      CustomFieldValueValidator.validateValue("url", "not-a-valid-url").error,
    ).toBe("Invalid URL format");
  });

  it("validates file type: accepts valid UUIDs, rejects non-UUIDs", () => {
    expect(
      CustomFieldValueValidator.validateValue(
        "file",
        "123e4567-e89b-12d3-a456-426614174000",
      ).valid,
    ).toBe(true);
    expect(
      CustomFieldValueValidator.validateValue("file", "non-uuid-file").valid,
    ).toBe(false);
  });

  it("validates list type: accepts string arrays, rejects non-arrays and mixed types", () => {
    expect(
      CustomFieldValueValidator.validateValue("list", [
        "Node.js",
        "PostgreSQL",
        "Valkey",
      ]).valid,
    ).toBe(true);
    // Non-array input (line 85 branch: !Array.isArray(value))
    expect(
      CustomFieldValueValidator.validateValue("list", "not-an-array").valid,
    ).toBe(false);
    expect(
      CustomFieldValueValidator.validateValue("list", "not-an-array").error,
    ).toBe("Expected array of strings");
    // Array with non-string items
    expect(
      CustomFieldValueValidator.validateValue("list", [1, 2, 3]).valid,
    ).toBe(false);
  });

  it("handles null and undefined values gracefully", () => {
    expect(CustomFieldValueValidator.validateValue("text", null).valid).toBe(
      true,
    );
    expect(
      CustomFieldValueValidator.validateValue("text", undefined).valid,
    ).toBe(true);
  });

  it("rejects unknown field types (default branch)", () => {
    expect(
      CustomFieldValueValidator.validateValue("unknown" as any, "sample").valid,
    ).toBe(false);
  });
});
