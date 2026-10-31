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

  it("validates diverse typed values correctly", () => {
    // Text
    expect(
      CustomFieldValueValidator.validateValue("text", "Software Architect")
        .valid,
    ).toBe(true);
    expect(CustomFieldValueValidator.validateValue("text", 12345).valid).toBe(
      false,
    );

    // Date
    expect(
      CustomFieldValueValidator.validateValue("date", "2026-10-30").valid,
    ).toBe(true);
    expect(
      CustomFieldValueValidator.validateValue("date", "30/10/2026").valid,
    ).toBe(false);

    // Number
    expect(CustomFieldValueValidator.validateValue("number", 42).valid).toBe(
      true,
    );
    expect(
      CustomFieldValueValidator.validateValue("number", "not-a-number").valid,
    ).toBe(false);

    // URL
    expect(
      CustomFieldValueValidator.validateValue(
        "url",
        "https://github.com/example",
      ).valid,
    ).toBe(true);
    expect(CustomFieldValueValidator.validateValue("url", "ftp://").valid).toBe(
      false,
    );

    // File
    expect(
      CustomFieldValueValidator.validateValue(
        "file",
        "123e4567-e89b-12d3-a456-426614174000",
      ).valid,
    ).toBe(true);
    expect(
      CustomFieldValueValidator.validateValue("file", "non-uuid-file").valid,
    ).toBe(false);

    // List
    expect(
      CustomFieldValueValidator.validateValue("list", [
        "Node.js",
        "PostgreSQL",
        "Valkey",
      ]).valid,
    ).toBe(true);
    expect(
      CustomFieldValueValidator.validateValue("list", [1, 2, 3]).valid,
    ).toBe(false);

    // Null and undefined
    expect(CustomFieldValueValidator.validateValue("text", null).valid).toBe(
      true,
    );
    expect(
      CustomFieldValueValidator.validateValue("text", undefined).valid,
    ).toBe(true);

    // Length and error bounds
    expect(
      CustomFieldValueValidator.validateValue("text", "a".repeat(5001)).valid,
    ).toBe(false);
    expect(
      CustomFieldValueValidator.validateValue("unknown" as any, "sample").valid,
    ).toBe(false);
  });
});
