import { describe, it, expect } from "vitest";
import {
  UploadIntentSchema,
  MagicByteVerifier,
} from "../../src/storage/upload.validator.js";

describe("File Upload Security & Magic Byte Inspection", () => {
  it("accepts valid upload intent within size limits", () => {
    const validIntent = {
      filename: "my_resume.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: 1024 * 1024, // 1MB
    };

    const parsed = UploadIntentSchema.safeParse(validIntent);
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported file types (e.g. svg, exe, bat)", () => {
    const maliciousIntent = {
      filename: "exploit.svg",
      mimeType: "image/svg+xml",
      sizeBytes: 1024,
    };

    const parsed = UploadIntentSchema.safeParse(maliciousIntent);
    expect(parsed.success).toBe(false);
  });

  it("verifies genuine PDF magic bytes (%PDF)", () => {
    const validPdfBuffer = Buffer.from([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
    ]);
    const isValid = MagicByteVerifier.verify(validPdfBuffer, "application/pdf");
    expect(isValid).toBe(true);
  });

  it("detects and rejects renamed executable disguised as PDF", () => {
    // Windows PE EXE header: MZ (4D 5A)
    const fakePdfBuffer = Buffer.from([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
    ]);
    const isValid = MagicByteVerifier.verify(fakePdfBuffer, "application/pdf");
    expect(isValid).toBe(false);
  });

  it("verifies genuine PNG magic bytes", () => {
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const isValid = MagicByteVerifier.verify(validPngBuffer, "image/png");
    expect(isValid).toBe(true);
  });

  it("verifies genuine JPEG, WebP, and DOCX magic bytes", () => {
    // JPEG
    const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(MagicByteVerifier.verify(jpegBuf, "image/jpeg")).toBe(true);

    // WebP
    const webpBuf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(MagicByteVerifier.verify(webpBuf, "image/webp")).toBe(true);

    // DOCX (Zip archive)
    const docxBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(
      MagicByteVerifier.verify(
        docxBuf,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("handles buffers shorter than 4 bytes and unknown MIME types safely", () => {
    expect(
      MagicByteVerifier.verify(Buffer.from([0x01]), "application/pdf"),
    ).toBe(false);
    expect(
      MagicByteVerifier.verify(
        Buffer.from([0x01, 0x02, 0x03, 0x04]),
        "unknown/mime",
      ),
    ).toBe(false);
  });
});
