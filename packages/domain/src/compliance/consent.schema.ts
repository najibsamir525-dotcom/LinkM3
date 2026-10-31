import { z } from "zod";

export const ConsentPurposeEnum = z.enum([
  "essential_cookies",
  "analytics_cookies",
  "ai_processing",
  "marketing_communications",
]);

export type ConsentPurpose = z.infer<typeof ConsentPurposeEnum>;

export const RecordConsentInputSchema = z.object({
  userId: z.string().uuid(),
  purpose: ConsentPurposeEnum,
  granted: z.boolean(),
  policyVersion: z.string().min(1),
  ipSubnet: z.string().max(45).nullable().optional(),
  userAgentCategory: z.string().max(64).nullable().optional(),
});

export type RecordConsentInput = z.infer<typeof RecordConsentInputSchema>;

export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
  ipSubnet: string | null;
  userAgentCategory: string | null;
  recordedAt: Date;
}
