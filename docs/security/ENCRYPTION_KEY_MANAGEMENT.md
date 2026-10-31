# Encryption Key Management Policy

**Document Version:** 1.0.0-draft  
**Status:** Under Review  
**Classification:** CONFIDENTIAL — Internal Engineering Only

---

## 1. Key Hierarchy

LINKME uses a single-tier envelope encryption scheme for field-level encryption (FLE) of sensitive profile data (phone, city, optional demographic fields such as age, gender, marital status, nationality).

| Key                             | Purpose                                    | Algorithm   | Length              | Storage Location                                                         |
| :------------------------------ | :----------------------------------------- | :---------- | :------------------ | :----------------------------------------------------------------------- |
| **Master Encryption Key (MEK)** | Encrypts/decrypts all FLE-protected fields | AES-256-GCM | 256 bits (32 bytes) | Environment variable `ENCRYPTION_MASTER_KEY` (hex-encoded, 64 hex chars) |

### 1.1 Where the Key Lives

- **Development:** Stored in the local `.env` file (which is `.gitignore`-listed and NEVER committed to version control).
- **CI/CD (GitHub Actions):** Stored as a GitHub Actions encrypted secret (`secrets.ENCRYPTION_MASTER_KEY`). GitHub encrypts secrets using libsodium sealed boxes before storage.
- **Production (Docker Compose on VM):** Stored in a restricted-permissions environment file (`/opt/linkme/.env.production`, mode `0600`, owned by `root:linkme-app`). The API and Worker containers read this file via `env_file:` in `docker-compose.yml`.
- **Future (Managed KMS):** When migrating to cloud-managed infrastructure, the MEK should be replaced with an envelope encryption scheme where the MEK is itself wrapped by a cloud KMS key (AWS KMS, GCP KMS, or HashiCorp Vault Transit). The application derives a Data Encryption Key (DEK) per operation using HKDF-SHA256.

### 1.2 Key Generation

Generate a cryptographically secure 256-bit key:

```bash
# Using Node.js (recommended)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

The output is a 64-character hexadecimal string. Store it directly as `ENCRYPTION_MASTER_KEY`.

---

## 2. Encrypted Payload Format & Version Prefix

All encrypted fields are stored in the database as text strings in the format:

```
v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
```

| Segment            | Description                                                                                                                            |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `v1`               | Version prefix identifying the encryption scheme and key generation. Enables future key rotation without breaking existing ciphertext. |
| `<iv_hex>`         | 12-byte (96-bit) random Initialization Vector, hex-encoded. Unique per encryption operation.                                           |
| `<auth_tag_hex>`   | 16-byte (128-bit) GCM Authentication Tag, hex-encoded. Detects any tampering with the ciphertext or IV.                                |
| `<ciphertext_hex>` | The encrypted data, hex-encoded.                                                                                                       |

---

## 3. Key Rotation Procedure

Key rotation replaces the active MEK with a new key. All existing encrypted data must be re-encrypted.

### 3.1 Steps

1. **Generate a new MEK:**

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Run the rotation script** (offline or during a scheduled maintenance window):

   ```bash
   # The script reads all FLE-encrypted columns, decrypts with the OLD key,
   # re-encrypts with the NEW key, and updates the database in a transaction.
   ENCRYPTION_OLD_KEY=<old_hex> ENCRYPTION_MASTER_KEY=<new_hex> \
     node scripts/rotate-encryption-key.ts
   ```

3. **Update the version prefix** (if the encryption algorithm or parameters change):
   - Increment from `v1` to `v2` in `EncryptionService`.
   - The decryption method checks the version prefix and dispatches to the correct algorithm.
   - Old `v1:`-prefixed ciphertext remains readable until fully re-encrypted.

4. **Update the secret** in the production environment file and restart the application containers.

5. **Verify** by running the integration test suite against the rotated database to confirm all encrypted fields decrypt correctly.

### 3.2 Rotation Frequency

- **Recommended:** Every 12 months, or immediately upon suspected compromise.
- **Mandatory:** Upon any employee departure with key access, or upon any security incident.

---

## 4. Lost Key Recovery

> [!CAUTION]
> **If the MEK is permanently lost and no backup exists, all FLE-encrypted data is irrecoverably destroyed.** AES-256-GCM has no mathematical backdoor.

### 4.1 Prevention

- The MEK backup is stored in a **separate, offline location** from database backups:
  - **Option A (Recommended):** A password-protected, encrypted USB drive stored in a physical safe accessible only to the system administrator.
  - **Option B:** A separate cloud KMS or secrets manager (e.g., 1Password Teams vault, Bitwarden organization vault) that is NOT the same provider or account as the database host.
- **The MEK MUST NEVER be stored inside database backups, application logs, or the same object storage bucket as `pg_dump` files.** If an attacker obtains both the encrypted database backup and the MEK from the same location, FLE provides zero additional protection.

### 4.2 Recovery Procedure

1. Retrieve the MEK backup from the offline safe or separate secrets manager.
2. Set `ENCRYPTION_MASTER_KEY=<recovered_hex>` in the production environment file.
3. Restart the application and run the integration test suite to verify decryption.
4. If the key cannot be recovered, affected users must be notified and asked to re-enter their phone number, address, and sensitive demographic fields.

---

## 5. Separation of Key Backups from Database Backups

| Backup Type                      | Storage Location                                         | Encryption                                                             | Access Control                                   |
| :------------------------------- | :------------------------------------------------------- | :--------------------------------------------------------------------- | :----------------------------------------------- |
| **Database Backups** (`pg_dump`) | Cloudflare R2 bucket `linkme-backups/postgres/`          | GPG symmetric encryption (AES-256) with `BACKUP_ENCRYPTION_PASSPHRASE` | R2 API keys restricted to backup service account |
| **MEK Backup**                   | Offline physical safe OR separate secrets manager        | Protected by physical security or vault master password                | Limited to system administrator(s) only          |
| **Backup Passphrase**            | Separate secrets manager (NOT stored in R2 or on the VM) | Protected by vault master password                                     | Limited to system administrator(s) only          |

> [!IMPORTANT]
> The three secrets (MEK, Backup Passphrase, R2 API keys) are stored in three separate locations. Compromise of any single location does not grant access to readable user data.

---

## 6. Audit & Compliance

- Every key rotation event is recorded in the `audit_logs` table with action `encryption_key_rotated` (no key material is logged).
- The `age_policy_version` and encrypted payload version prefix (`v1:`) provide cryptographic provenance for compliance audits.
- Annual review of this document is required.
