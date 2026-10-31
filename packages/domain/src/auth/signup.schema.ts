import { z } from "zod";
import { PasswordPolicyValidator } from "./password.policy.js";

export const SignupInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "A valid email address is required." }),
  password: z
    .string()
    .min(12, { message: "Password must be at least 12 characters long." })
    .max(128, { message: "Password cannot exceed 128 characters." })
    .refine(
      (pwd) =>
        !PasswordPolicyValidator.validate(pwd).errors.some((e) =>
          e.includes("common"),
        ),
      "This password is too common or has appeared in a data breach. Please choose a different password.",
    ),
  ageConfirmed: z.literal(
    true,
    "You must confirm that you are at least 18 years old to create an account.",
  ),
  termsAccepted: z.literal(
    true,
    "You must accept the Terms of Service and Privacy Policy to register.",
  ),
  policyVersion: z.string().min(1).default("v1.0"),
  locale: z.enum(["en", "ar"]).default("en"),
});

export type SignupInput = z.infer<typeof SignupInputSchema>;

export interface RegisteredUserResult {
  id: string;
  email: string;
  locale: string;
  ageConfirmed: boolean;
  ageConfirmedAt: Date;
  agePolicyVersion: string;
  emailVerified: boolean;
  role: "USER";
  status: "PENDING_VERIFICATION";
  createdAt: Date;
}
