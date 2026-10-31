# Open Questions, Assumptions & Jurisdictional Roadmap

**Document Version:** 1.1.0  
**Status:** Maintained & Updated  
**Authors:** Senior Staff Engineer, Security & Privacy Engineering

---

## 1. Locked Decisions & Updated Defaults

1. **Minimum Age Gate:**
   - Enforced at **18 years old**.
   - Configurable via server environment variable `MIN_SIGNUP_AGE=18` and policy version (e.g. `AGE_POLICY_VERSION=v1.0`).
   - Stored in database upon registration: `age_confirmed: true`, `age_confirmed_at: timestamp`, `age_policy_version: string`.
   - **Data Minimization:** No date of birth is collected anywhere in the system. Terms of Service explicitly state the 18+ requirement. Registration fails immediately with `400 Bad Request` if `age_confirmed` is false.

2. **Zero Monetization & Free Beta Model:**
   - The platform is **100% free** during beta.
   - No billing integration, no payment gateways, no checkout flows, and no pricing pages are active in the MVP.
   - Billing tables (`plans`, `subscriptions`, `payments`, `ai_credit_ledger`) exist in the DDL for forward compatibility, but remain completely dormant behind feature flag `FEATURE_BILLING_ENABLED=false`.
   - **Zero Ads, Zero Data Sale:** Privacy policy explicitly states user data is never sold, shared, rented, or monetized for advertising.
   - **Terms Clause:** "Free during public beta; monetization or premium features may be introduced in the future with advance notice and re-consent where required by law."
   - Rate limiting is enforced strictly on all resource-heavy endpoints (uploads, exports, auth) to keep consumption well within free-tier limits.

3. **In-Memory Cache & Queue Broker:**
   - **Valkey 7.2+** (BSD-3-Clause open-source fork) is selected as the drop-in, 100% wire-compatible replacement for Redis. This avoids any licensing ambiguity associated with the RSALv2 license change while remaining completely compatible with BullMQ and standard Redis clients (`ioredis`).

4. **Image Processing & libvips:**
   - Profile photo upload stripping (EXIF/metadata removal) and thumbnail generation use `sharp`.
   - Pre-built `sharp` binaries bundle their own statically-linked libvips, eliminating runtime OS package conflicts.

5. **AI Pipeline Status:**
   - **AI features are completely DISABLED (`AI_PIPELINE_MODE=disabled`) for the MVP build.**
   - No data is transmitted to any external LLM provider.
   - Provider abstraction remains in architecture supporting future BYOK (user API key) or paid tiers.

---

## 2. Retention Schedule Defaults (Marked: _DRAFT - REQUIRES LAWYER REVIEW_)

| Data Category                 | Target Tables / Storage              | Retention Default               | Deletion / Expiry Mechanism                                                                                                                                              |
| :---------------------------- | :----------------------------------- | :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deleted User Accounts**     | `users`, `profiles`, `resumes`, etc. | **Full erasure within 30 days** | User request initiates soft-delete status (`pending_deletion`). At Day 30 (or immediately if user opts out of grace period), hard cascade purges DB rows and S3 objects. |
| **Database Backups**          | Encrypted `pg_dump` on Cloudflare R2 | **30-day rolling rotation**     | Automated R2 bucket lifecycle rule deletes backup tarballs older than 30 days. Deleted user data is permanently unrecoverable after 30 days.                             |
| **Security & Audit Logs**     | `audit_logs`                         | **12 months**                   | PII-minimized at ingestion (IP anonymized to subnet, actor identifiers unlinked upon account erasure). Pruned after 365 days.                                            |
| **Share Link Analytics**      | `link_views` (Partitioned)           | **12 months**                   | Country-level and device-category only (zero IP addresses, zero cookies). Monthly database partition drops after 12 months.                                              |
| **Export Files (PDF / DOCX)** | S3 Object Storage (`export_jobs`)    | **7 days**                      | S3 bucket lifecycle rule auto-purges generated export files 7 days after generation.                                                                                     |
| **Payment Records**           | `payments`                           | **N/A while free**              | When billing is introduced: 7–10 years retention under statutory tax law with user identifiers pseudonymized.                                                            |

---

## 3. Jurisdictional Roadmap: Lebanon & MENA Launch vs. Future EU/UK/US Expansion

The platform launches primarily for **Lebanon and the MENA region**, with international privacy architecture (GDPR-grade rights) built into the code from Day 1.

### 3.1 Initial Launch: Lebanon & MENA (Law 81/2018 Focus)

- **Applicable Framework:** Lebanese Law No. 81/2018 on Electronic Transactions and Personal Data.
- **Controller Obligations:** Clear notice of data controller identity, right to rectification, right to object to commercial marketing, and transparent retention limits.
- **Language & Direction:** Arabic and English bilingual capabilities, full RTL layout mirroring, and Arabic typography are first-class requirements.
- **MoET Notification:** Chapter 2 of Law 81 requires certain data processing notifications to the Ministry of Economy and Trade. Flagged for local legal counsel review prior to full commercial promotion.

### 3.2 Future Expansion Trigger: Actively Targeting EU / UK (GDPR & UK GDPR)

If the platform expands marketing, localized pricing, or targeted operations to the EU/UK:

1. **Article 27 EU/UK Representative:** Must formally appoint a designated representative located in the EU and UK if LINKME has no physical establishment in those jurisdictions.
2. **International Data Transfers (Chapter V):** Ensure Standard Contractual Clauses (SCCs) and Transfer Impact Assessments (TIAs) are formalized for any data processed outside the EEA.
3. **Formal DPO (Data Protection Officer):** Review necessity under Article 37 if processing reaches large-scale monitoring.
4. **Cookie Consent Formalism:** Keep strict prior-opt-in cookie banner active with affirmative consent logging before firing non-essential scripts.

### 3.3 Future Expansion Trigger: Actively Targeting US (CCPA/CPRA, State Privacy Laws)

If expanding targeted services to California or other US states:

1. **"Do Not Sell or Share My Personal Information":** Prominent footer link required. (Currently fulfilled by policy: we do not sell or share data).
2. **Notice at Collection:** Updated CCPA privacy disclosure covering statutory categories of personal information collected in preceding 12 months.
3. **COPPA Strict Liability:** Maintain strict 18+ age gate to remain outside COPPA (<13) and California Age-Appropriate Design Code frameworks.
