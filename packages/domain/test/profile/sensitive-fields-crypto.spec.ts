import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { EncryptionService } from "../../src/crypto/encryption.service.js";

describe("UC-10: Field-Level Encryption (AES-256-GCM)", () => {
  const masterKeyHex = crypto.randomBytes(32).toString("hex");

  it("encrypts and decrypts strings with authenticated tag verification", () => {
    const sensitiveAddress = "742 Evergreen Terrace, Springfield";
    const encrypted = EncryptionService.encrypt(sensitiveAddress, masterKeyHex);

    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain(sensitiveAddress);

    const decrypted = EncryptionService.decrypt(encrypted, masterKeyHex);
    expect(decrypted).toBe(sensitiveAddress);
  });

  it("encrypts and decrypts complex JSON payloads (sensitive demographic fields)", () => {
    const sensitivePayload = {
      age: 29,
      gender: "Non-binary",
      maritalStatus: "Single",
      nationality: "Lebanese",
    };

    const encrypted = EncryptionService.encryptJson(
      sensitivePayload,
      masterKeyHex,
    );
    const decrypted = EncryptionService.decryptJson<typeof sensitivePayload>(
      encrypted,
      masterKeyHex,
    );

    expect(decrypted).toEqual(sensitivePayload);
  });

  it("fails decryption if ciphertext has been tampered with (Auth Tag Mismatch)", () => {
    const sensitiveAddress = "Confidential Medical Address";
    const encrypted = EncryptionService.encrypt(sensitiveAddress, masterKeyHex);

    const parts = encrypted.split(":");
    // Tamper with the ciphertext segment
    const tamperedCiphertext = "00" + parts[3]!.slice(2);
    const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCiphertext}`;

    expect(() =>
      EncryptionService.decrypt(tamperedPayload, masterKeyHex),
    ).toThrow();
  });

  it("rejects keys that are not exactly 32 bytes", () => {
    const invalidKey = "tooshortkey123";
    expect(() => EncryptionService.encrypt("Test", invalidKey)).toThrow(
      "32 bytes",
    );
  });

  it("rejects payloads with invalid version prefix or malformed segments", () => {
    expect(() => EncryptionService.decrypt("v2:1:2:3", masterKeyHex)).toThrow(
      "Invalid encrypted payload",
    );
    expect(() => EncryptionService.decrypt("v1:1:2", masterKeyHex)).toThrow(
      "Invalid encrypted payload",
    );
  });
});
