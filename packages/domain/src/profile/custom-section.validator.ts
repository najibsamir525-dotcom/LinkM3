import { z } from "zod";

export const CustomFieldTypeEnum = z.enum([
  "text",
  "date",
  "number",
  "url",
  "file",
  "list",
]);

export type CustomFieldType = z.infer<typeof CustomFieldTypeEnum>;

export const CreateCustomFieldSchema = z.object({
  sectionId: z.string().uuid(),
  label: z.string().trim().min(1).max(128),
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, {
      message:
        "Field key must be lowercase alphanumeric with underscores only.",
    }),
  dataType: CustomFieldTypeEnum,
  required: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateCustomFieldInput = z.infer<typeof CreateCustomFieldSchema>;

export class CustomFieldValueValidator {
  static validateValue(
    dataType: CustomFieldType,
    value: unknown,
  ): { valid: boolean; error?: string } {
    if (value === null || value === undefined) {
      return { valid: true };
    }

    switch (dataType) {
      case "text":
        if (typeof value !== "string")
          return { valid: false, error: "Expected string value" };
        if (value.length > 5000)
          return { valid: false, error: "Text exceeds maximum length of 5000" };
        return { valid: true };

      case "date":
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return { valid: false, error: "Expected date format YYYY-MM-DD" };
        }
        return { valid: true };

      case "number":
        if (typeof value !== "number" || Number.isNaN(value)) {
          return { valid: false, error: "Expected numeric value" };
        }
        return { valid: true };

      case "url":
        if (typeof value !== "string")
          return { valid: false, error: "Expected URL string" };
        try {
          new URL(value);
          return { valid: true };
        } catch {
          return { valid: false, error: "Invalid URL format" };
        }

      case "file":
        if (
          typeof value !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            value,
          )
        ) {
          return { valid: false, error: "Expected valid asset UUID" };
        }
        return { valid: true };

      case "list":
        if (!Array.isArray(value))
          return { valid: false, error: "Expected array of strings" };
        if (value.some((item) => typeof item !== "string")) {
          return { valid: false, error: "All items in list must be strings" };
        }
        return { valid: true };

      default:
        return { valid: false, error: "Unknown field type" };
    }
  }
}
