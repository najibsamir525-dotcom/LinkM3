import { z } from "zod";

export const SensitiveFieldsSchema = z.object({
  age: z.number().int().min(18).max(120).optional(),
  gender: z.string().max(50).optional(),
  maritalStatus: z.string().max(50).optional(),
  nationality: z.string().max(100).optional(),
});

export type SensitiveFields = z.infer<typeof SensitiveFieldsSchema>;

export const LinkItemSchema = z.object({
  label: z.string().min(1).max(50),
  url: z.string().url().max(512),
});

export const MasterProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(255),
  headline: z.string().trim().max(255).optional(),
  bio: z.string().trim().max(5000).optional(),
  photoAssetId: z.string().uuid().nullable().optional(),
  phone: z.string().max(50).optional(),
  city: z.string().max(100).optional(),
  links: z.array(LinkItemSchema).default([]),
  sensitiveFields: SensitiveFieldsSchema.optional(),
});

export type MasterProfileInput = z.infer<typeof MasterProfileSchema>;

export const ExperienceSchema = z
  .object({
    profileId: z.string().uuid(),
    company: z.string().trim().min(1).max(255),
    title: z.string().trim().min(1).max(255),
    location: z.string().trim().max(255).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
      .nullable()
      .optional(),
    description: z.string().max(5000).optional(),
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be after or equal to start date.",
    path: ["endDate"],
  });

export type ExperienceInput = z.infer<typeof ExperienceSchema>;

export const EducationSchema = z
  .object({
    profileId: z.string().uuid(),
    institution: z.string().trim().min(1).max(255),
    degree: z.string().trim().min(1).max(255),
    fieldOfStudy: z.string().trim().max(255).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
      .nullable()
      .optional(),
    description: z.string().max(5000).optional(),
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be after or equal to start date.",
    path: ["endDate"],
  });

export type EducationInput = z.infer<typeof EducationSchema>;
