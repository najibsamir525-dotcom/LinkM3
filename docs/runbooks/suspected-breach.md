# Runbook: Suspected Data Breach & Incident Response

**Document Version:** 1.0.0  
**Classification:** Security Incident Response & Legal Compliance  
**Severity:** P0/P1 — Security Incident  
**Legal Mandate:** GDPR Article 33/34 (72-hour regulatory notification window) & Lebanese Law 81/2018.

---

## 1. Incident Containment (First 30 Minutes)

1. **Immediate Revocation of Compromised Credentials:**
   - If an API key or server credential is suspected compromised:
     - Rotate GitHub Actions secrets, Cloudflare R2 API tokens, and VM SSH keys immediately.
   - If user sessions or tokens are compromised:
     - Invalidate all active Valkey sessions:
       ```bash
       docker compose -f docker-compose.prod.yml exec valkey valkey-cli FLUSHDB
       ```

2. **Isolate Affected Host or Container:**
   - If unauthorized root access is suspected on the VM:
     - Snapshot the VM disk for forensic investigation.
     - Temporarily block ingress traffic at Cloudflare WAF: enable **"Under Attack Mode"** and IP rate-limiting to halt data exfiltration.

3. **Check Field-Level Encryption Integrity:**
   - Review database access logs: if raw PostgreSQL data was accessed without the application host memory (where `ENCRYPTION_MASTER_KEY` resides), all phone numbers, locations, and sensitive demographic data remain mathematically protected by AES-256-GCM.

---

## 2. Investigation & Forensic Evidence Collection

1. **Audit Log Inspection:**

   ```bash
   # Query audit logs for anomalous mass read queries or administrative actions
   docker compose -f docker-compose.prod.yml exec postgres psql -U linkme_user -d linkme_db -c "
   SELECT created_at, actor_role, action, target_type, ip_subnet
   FROM audit_logs
   ORDER BY created_at DESC LIMIT 100;
   "
   ```

2. **Access Log & Nginx Analysis:**
   - Review `/var/log/nginx/access.log` for high-volume scrapers, SQL injection probes, or path traversal attempts.

---

## 3. Mandatory Regulatory & User Notification Workflow

### 3.1 Regulatory Notification (Within 72 Hours)

Under GDPR Article 33 and relevant data protection authorities:

- Notify the competent Supervisory Authority (DPA) within 72 hours of becoming aware of the breach.
- Required details:
  - Nature of personal data breach, categories, and approximate number of data subjects affected.
  - Name and contact details of the Data Protection Officer or security lead.
  - Likely consequences and risks to data subjects.
  - Measures taken or proposed to mitigate and address the breach.

### 3.2 User Notification (Without Undue Delay)

Under GDPR Article 34:

- If the breach is likely to result in a high risk to the rights and freedoms of individuals:
  - Send direct notification email to affected data subjects.
  - Clear, plain-language description of what happened, what data was exposed (e.g. email vs FLE encrypted fields), and recommended actions (e.g. password resets).
  - Provide a dedicated support channel: `security@linkme.cv`.
