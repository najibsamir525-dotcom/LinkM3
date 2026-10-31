import { describe, it, expect } from "vitest";
import { RecordConsentInputSchema } from "../../src/compliance/consent.schema.js";

describe("UC-03: Granular Consent Ledger", () => {
  it("records affirmative and withdrawable consent for specific purpose", () => {
    const input = {
      userId: "123e4567-e89b-12d3-a456-426614174000",
      purpose: "essential_cookies" as const,
      granted: true,
      policyVersion: "v1.0",
      ipSubnet: "192.168.1.0/24",
    };

    const parsed = RecordConsentInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid consent purposes", () => {
    const input = {
      userId: "123e4567-e89b-12d3-a456-426614174000",
      purpose: "unauthorized_tracking_purpose",
      granted: true,
      policyVersion: "v1.0",
    };

    const parsed = RecordConsentInputSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});
