import { describe, it, expect } from "vitest";
import { SAMPLE_CV, hasUnchangedSampleContent } from "../src/sample-cv.js";

describe("Sample CV Data Integrity & Export Warning Guard", () => {
  it("contains strictly fictional data and no real PII", () => {
    expect(SAMPLE_CV.fullName).toBe("Alex Morgan");
    expect(SAMPLE_CV.contact.email).toBe("alex.morgan.demo@linkme.cv");
    expect(SAMPLE_CV.contact.phone).toBe("+20 100 000 0000");
    expect(SAMPLE_CV.id).toBe("sample-preview-fictional");
  });

  it("detects unchanged sample data to prompt user warning before PDF export", () => {
    // Exact sample CV must trigger warning
    expect(hasUnchangedSampleContent(SAMPLE_CV)).toBe(true);

    // Partially modified CV with sample email still triggers warning
    const partialDoc = {
      ...SAMPLE_CV,
      id: "custom-user-cv-123",
      fullName: "Jane Doe",
      // sample email unchanged
    };
    expect(hasUnchangedSampleContent(partialDoc)).toBe(true);

    // Fully customized user CV does NOT trigger warning
    const userDoc = {
      ...SAMPLE_CV,
      id: "custom-user-cv-123",
      fullName: "Samir Professional",
      contact: {
        ...SAMPLE_CV.contact,
        email: "samir@mycompany.com",
      },
    };
    expect(hasUnchangedSampleContent(userDoc)).toBe(false);
  });
});
