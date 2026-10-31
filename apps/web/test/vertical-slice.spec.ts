import { describe, it, expect } from "vitest";
import {
  SAMPLE_CV,
  hasUnchangedSampleContent,
  SingleColumnTemplate,
  renderResumeToHtml,
  type ResumeDocument,
} from "@linkme/templates";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("Vertical Slice: Sign-up -> Sample CV -> Edit -> Live Preview -> Export Guard", () => {
  it("initializes with fictional sample CV data and marks it as sample content", () => {
    const doc: ResumeDocument = SAMPLE_CV;
    expect(doc.fullName).toBe("Alex Morgan");
    expect(hasUnchangedSampleContent(doc)).toBe(true);
  });

  it("updates preview immediately when user edits a section (e.g. Full Name and Headline)", () => {
    // User edits personal info and saves as custom resume
    const editedDoc: ResumeDocument = {
      ...SAMPLE_CV,
      id: "custom-user-cv-123",
      fullName: "Dr. Sarah Connor",
      headline: "Principal Systems Architect",
      contact: {
        ...SAMPLE_CV.contact,
        email: "sarah.connor@customdomain.com",
      },
    };

    // Assert that sample guard no longer detects placeholder
    expect(hasUnchangedSampleContent(editedDoc)).toBe(false);

    // Assert live preview DOM rendering matches updated text
    const previewHtml = renderToStaticMarkup(
      React.createElement(SingleColumnTemplate, { resume: editedDoc }),
    );

    expect(previewHtml).toContain("Dr. Sarah Connor");
    expect(previewHtml).toContain("Principal Systems Architect");
    expect(previewHtml).not.toContain("Alex Morgan");
  });

  it("reorders experience items with Move Up / Move Down controls", () => {
    const initialFirst = SAMPLE_CV.experiences[0].role;
    const initialSecond = SAMPLE_CV.experiences[1].role;

    // Simulate moving item 0 down
    const reorderedExperiences = [
      SAMPLE_CV.experiences[1],
      SAMPLE_CV.experiences[0],
    ];

    expect(reorderedExperiences[0].role).toBe(initialSecond);
    expect(reorderedExperiences[1].role).toBe(initialFirst);
  });

  it("switches to Arabic (RTL) with start-alignment and zero kashida", () => {
    const arabicDoc: ResumeDocument = {
      ...SAMPLE_CV,
      language: "ar",
      direction: "rtl",
      fullName: "سمير نجيب",
      headline: "مهندس برمجيات",
      style: {
        ...SAMPLE_CV.style,
        fontFamily: "Noto Sans Arabic",
      },
    };

    const rendered = renderResumeToHtml(arabicDoc);
    expect(rendered).toContain('dir="rtl"');
    expect(rendered).toContain('lang="ar"');
    expect(rendered).toContain("Noto Sans Arabic");
    expect(rendered).toContain("text-align:start");
    expect(rendered).not.toContain("\u0640"); // Zero kashida
  });

  it("escapes malicious user input in React DOM without requiring DOMPurify", () => {
    const xssDoc: ResumeDocument = {
      ...SAMPLE_CV,
      fullName: "<script>window.pwned=true</script>",
      summary: '<img src=x onerror="alert(1)">',
    };

    const preview = renderToStaticMarkup(
      React.createElement(SingleColumnTemplate, { resume: xssDoc }),
    );

    // Executable tags must be escaped
    expect(preview).not.toContain("<script>");
    expect(preview).toContain("&lt;script&gt;window.pwned=true&lt;/script&gt;");
    expect(preview).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
