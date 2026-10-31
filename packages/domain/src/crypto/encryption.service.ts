import crypto from "node:crypto";

export class EncryptionService {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits
  private static readonly VERSION_PREFIX = "v1";

  /**
   * Encrypts plaintext string using AES-256-GCM
   * Output format: v1:iv_hex:auth_tag_hex:ciphertext_hex
   */
  static encrypt(plaintext: string, masterKeyHex: string): string {
    const key = Buffer.from(masterKeyHex, "hex");
    if (key.length !== 32) {
      throw new Error(
        "Master key must be exactly 32 bytes (256 bits) in hex format.",
      );
    }

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${this.VERSION_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
  }

  /**
   * Decrypts encrypted payload using AES-256-GCM
   */
  static decrypt(encryptedPayload: string, masterKeyHex: string): string {
    const parts = encryptedPayload.split(":");
    if (parts.length !== 4 || parts[0] !== this.VERSION_PREFIX) {
      throw new Error("Invalid encrypted payload format.");
    }

    const [, ivHex, authTagHex, ciphertextHex] = parts;
    if (!ivHex || !authTagHex || !ciphertextHex) {
      throw new Error("Malformed encrypted payload segments.");
    }

    const key = Buffer.from(masterKeyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  /**
   * Encrypts a JSON serializable object
   */
  static encryptJson<T>(data: T, masterKeyHex: string): string {
    return this.encrypt(JSON.stringify(data), masterKeyHex);
  }

  /**
   * Decrypts into a parsed JSON object
   */
  static decryptJson<T>(encryptedPayload: string, masterKeyHex: string): T {
    const jsonStr = this.decrypt(encryptedPayload, masterKeyHex);
    return JSON.parse(jsonStr) as T;
  }
}
