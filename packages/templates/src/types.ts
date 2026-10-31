/**
 * @linkme/templates — Types
 */

export interface ContactInfo {
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  bullets: string[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  location?: string;
  graduationYear?: string;
}

export interface SkillCategory {
  id: string;
  category: string;
  skills: string[];
}

export interface ResumeDocument {
  id: string;
  title: string;
  fullName: string;
  headline: string;
  summary: string;
  contact: ContactInfo;
  experiences: ExperienceItem[];
  educations: EducationItem[];
  skills: SkillCategory[];
  language: "en" | "ar";
  direction: "ltr" | "rtl";
  style: {
    fontFamily: "Inter" | "Roboto" | "Noto Sans Arabic" | "Amiri";
    fontSize: number; // in pt (e.g. 10)
    primaryColor: string;
    lineSpacing: number; // e.g. 1.4
    margins: number; // in mm (e.g. 15)
    paperFormat: "A4" | "Letter";
  };
}
