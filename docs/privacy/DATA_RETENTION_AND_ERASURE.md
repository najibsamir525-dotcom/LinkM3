# Data Retention & Account Erasure Policy

**Document Version:** 1.0.0  
**Effective Date:** 2026-10-31  
**Regulatory Framework:** GDPR (Articles 5(1)(e), 17), Saudi Arabia PDPL, Egyptian Law 151 of 2020

---

## 1. Statutory Retention Windows

| Data Category                                        | Primary Storage        | Retention Period           | Post-Retention Disposition                                 |
| :--------------------------------------------------- | :--------------------- | :------------------------- | :--------------------------------------------------------- |
| **Active User Account Data** (profiles, CVs, links)  | PostgreSQL 16          | Duration of active account | Cascading purge on user deletion                           |
| **Object Storage Assets** (avatars, document proofs) | S3 / Cloudflare R2     | Duration of active account | Synchronous purge on user deletion                         |
| **Audit Logs** (security provenance)                 | PostgreSQL 16          | 30 days active             | Actor ID anonymized, tombstoned                            |
| **Point-in-Time Database Backups**                   | Encrypted Object Store | **30 days maximum**        | **Automated lifecycle expiration & permanent destruction** |

---

## 2. Right to Erasure Execution (GDPR Article 17)

Upon user invocation of `eraseAccount(userId)`:

1. **Better Auth Credential Tables:** Immediate cascading deletion from `two_factor`, `verification`, `account`, `session`, and `user`.
2. **Domain Relational Tables:** Foreign key cascading deletion across `profiles`, `experiences`, `educations`, `skills`, `projects`, `certifications`, `custom_sections`, `resumes`, `templates`, and `media_assets`.
3. **Object Storage Purge:** All keys prefixed with `users/{userId}/*` are deleted from S3/R2 storage.
4. **Session & Cache Purge:** Active sessions in PostgreSQL and Valkey caches are invalidated immediately.
5. **Security Audit Anonymization:** Under GDPR Article 17(3)(e), audit logs are retained solely for forensic/security defense, but `actor_id` is replaced with `NULL`, IP addresses are zeroed to `0.0.0.0/0`, and metadata is marked `anonymized: true`.
6. **Encrypted Backup Expiration:** Historical point-in-time database snapshots (`pg_dump`) containing the user's encrypted records rotate out and permanently expire within **30 days** via automated bucket lifecycle rules.
7. **Cryptographic Erasure Certificate:** The user and compliance ledger receive an `AccountErasureResult` containing a SHA-256 digital digest of the erasure operation.
