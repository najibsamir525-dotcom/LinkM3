/**
 * @linkme/templates — Fictional Sample CV
 *
 * Contains 100% fictional data. Used for the guided first-time flow.
 * Never saved to server until user explicitly edits a field.
 */

import type { ResumeDocument } from "./types.js";

export const SAMPLE_CV: ResumeDocument = {
  id: "sample-preview-fictional",
  title: "Software Engineer Sample",
  fullName: "Alex Morgan",
  headline: "Senior Full-Stack Engineer",
  summary:
    "Experienced software engineer specializing in high-throughput distributed systems, modern web architectures, and web accessibility (WCAG 2.2). Dedicated to building privacy-respecting, zero-latency digital experiences.",
  contact: {
    email: "alex.morgan.demo@linkme.cv",
    phone: "+20 100 000 0000",
    location: "Alexandria, Egypt",
    website: "https://linkme.cv",
  },
  experiences: [
    {
      id: "exp-sample-1",
      role: "Staff Software Engineer",
      company: "Acme Systems Inc.",
      location: "Cairo, Egypt",
      startDate: "2022",
      endDate: "Present",
      isCurrent: true,
      bullets: [
        "Architected distributed event-driven pipeline processing 15M messages daily using Node.js and Valkey.",
        "Engineered accessible, localized UI components compliant with WCAG 2.2 AA in both LTR and RTL directions.",
        "Reduced p99 server response latency from 180ms to 28ms through database query indexing and caching.",
      ],
    },
    {
      id: "exp-sample-2",
      role: "Full-Stack Developer",
      company: "Pyramid Digital Solutions",
      location: "Alexandria, Egypt",
      startDate: "2019",
      endDate: "2022",
      isCurrent: false,
      bullets: [
        "Built responsive client portals using React, TypeScript, and PostgreSQL with field-level encryption.",
        "Integrated automated visual regression and accessibility testing in CI/CD pipeline.",
      ],
    },
  ],
  educations: [
    {
      id: "edu-sample-1",
      degree: "B.S. in Computer Science",
      institution: "Alexandria Institute of Technology",
      location: "Alexandria, Egypt",
      graduationYear: "2019",
    },
  ],
  skills: [
    {
      id: "skill-sample-1",
      category: "Engineering",
      skills: [
        "TypeScript",
        "React",
        "Node.js",
        "PostgreSQL",
        "Docker",
        "Tailwind CSS",
      ],
    },
    {
      id: "skill-sample-2",
      category: "Core Competencies",
      skills: [
        "WCAG 2.2 AA Accessibility",
        "RTL Localization",
        "Optimistic Locking",
        "Distributed Systems",
      ],
    },
  ],
  language: "en",
  direction: "ltr",
  style: {
    fontFamily: "Inter",
    fontSize: 10,
    primaryColor: "#0f172a",
    lineSpacing: 1.4,
    margins: 15,
    paperFormat: "A4",
  },
};

/**
 * Checks if the resume document still contains unmodified sample/placeholder data.
 */
export function hasUnchangedSampleContent(doc: ResumeDocument): boolean {
  return (
    doc.id === SAMPLE_CV.id ||
    doc.fullName === SAMPLE_CV.fullName ||
    doc.contact.email === SAMPLE_CV.contact.email
  );
}
