import { z } from "zod";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

export const UploadIntentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    message:
      "Unsupported file type. Only PDF, DOCX, JPEG, PNG, and WebP are allowed.",
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, {
      message: `File size exceeds the maximum limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
    }),
});

export type UploadIntentInput = z.infer<typeof UploadIntentSchema>;

export class MagicByteVerifier {
  /**
   * Verifies the magic header bytes of a buffer against declared MIME type.
   * Protects against disguised executables and polyglot files.
   */
  static verify(buffer: Buffer, declaredMime: string): boolean {
    if (buffer.length < 4) return false;

    // PDF: %PDF (25 50 44 46)
    if (declaredMime === "application/pdf") {
      return (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      );
    }

    // JPEG: FF D8 FF
    if (declaredMime === "image/jpeg") {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (declaredMime === "image/png") {
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    }

    // WebP: RIFF .... WEBP
    if (declaredMime === "image/webp") {
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    }

    // DOCX: Zip format PK.. (50 4B 03 04)
    if (
      declaredMime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return (
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
        (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
      );
    }

    return false;
  }
}
