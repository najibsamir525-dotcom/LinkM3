# Runbook: Field-Level Encryption Key Rotation (MEK)

**Document Version:** 1.0.0  
**Classification:** Cryptographic Operations Runbook  
**Severity:** P2 (Planned Maintenance) / P1 (Emergency Compromise)  
**Reference:** `/docs/security/ENCRYPTION_KEY_MANAGEMENT.md`

---

## 1. Overview & Rotation Strategy

LINKME encrypts sensitive profile fields (`phone`, `city`, demographic fields) using **AES-256-GCM** with a versioned envelope prefix:
`v1:iv_hex:auth_tag_hex:ciphertext_hex`

Key rotation replaces the active Master Encryption Key (MEK) with a new 256-bit key. The rotation script re-encrypts all database records in-place within a transaction without service interruption.

---

## 2. Rotation Procedure

### Step 2.1: Generate the New MEK

Generate a cryptographically secure 256-bit key (64 hex characters):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output example: e8d4f9b2a1c0... (store securely)
```

### Step 2.2: Execute Database Re-Encryption Script

Run the rotation script supplying both the old key (for decryption) and the new key (for re-encryption):

```bash
cd /opt/linkme
ENCRYPTION_OLD_KEY="<CURRENT_HEX_KEY>" \
ENCRYPTION_MASTER_KEY="<NEW_HEX_KEY>" \
node scripts/rotate-encryption-key.mjs
```

The script:

1. Opens a database transaction.
2. Selects all rows from `profiles` where `phone_encrypted`, `city_encrypted`, or `optional_sensitive_fields_encrypted` is NOT NULL.
3. Decrypts each field using `ENCRYPTION_OLD_KEY`.
4. Re-encrypts each field with a fresh IV using `ENCRYPTION_MASTER_KEY`.
5. Updates the database rows and commits the transaction.
6. Writes an audit log entry: `action: "encryption_key_rotated"`.

### Step 2.3: Update Production Environment & Restart Containers

1. Update `/opt/linkme/.env.production`:

   ```bash
   sed -i "s/^ENCRYPTION_MASTER_KEY=.*/ENCRYPTION_MASTER_KEY=<NEW_HEX_KEY>/" /opt/linkme/.env.production
   ```

2. Restart application containers to load the new key into memory:

   ```bash
   docker compose -f /opt/linkme/docker-compose.prod.yml restart api worker
   ```

3. Securely back up the new key in the offline safe per `ENCRYPTION_KEY_MANAGEMENT.md`.

---

## 3. Verification

```bash
# Verify API profile retrieval decrypts cleanly
curl -sS -H "Authorization: Bearer <TEST_TOKEN>" https://linkme.cv/api/profile/me | grep -q "phone" && echo "Key rotation: SUCCESS"
```
