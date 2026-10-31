# ZimMedPractice — Security and Privacy

## 1. Assets and threats

| Asset | Main threats |
|---|---|
| Clinical notes, diagnoses, results | Staff snooping, stolen server or disk, leaked backup, SQL injection |
| Demographics and national IDs | Bulk export, identity fraud |
| Financial records and cash-ups | Fraud by insiders (voids, edited receipts) |
| Credentials | Shared passwords, phishing, brute force |
| Offline data on workstations | Shared or stolen PCs |

Assumptions: a single trusted server in a locked room, staff on shared PCs, and the
internet connection is hostile.

## 2. Authentication (Better Auth, self-hosted)

- Login is by username and password, hashed with scrypt (Better Auth default).
  Passwords must be at least 10 characters and are checked against a common-password
  list.
- **TOTP 2FA is mandatory for admin and doctor roles**, optional for nurse and
  reception. Backup codes are issued.
- Login is rate-limited (5 attempts / 15 min per IP+username). Cookies are `HttpOnly`,
  `Secure`, `SameSite=Lax`.
- Sessions live in the DB, expire after 12 h (a shift), and are revocable by admin.
  The UI **idle-locks after 10 min** and asks for the password again.
- Disabling a user revokes all of their sessions immediately.

## 3. Transport

- HTTPS everywhere, including on the LAN (Caddy + Let's Encrypt via DNS-01). Remote
  access uses Cloudflare Tunnel with no inbound ports.
- Headers: HSTS, CSP (`default-src 'self'`; no third-party scripts), `frame-ancestors
  'none'`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `X-Content-Type-Options`.

## 4. Authorisation (RBAC)

Enforced server-side on every route (`server/rbac.ts`). The UI hiding a menu is
convenience only.

| Permission | ADM | DR | NU | RC |
|---|:-:|:-:|:-:|:-:|
| patients:read / write | ✓ | ✓ | ✓ | ✓ |
| appointments:read / write | ✓ | ✓ | ✓ | ✓ |
| queue:read / write | ✓ | ✓ | ✓ | ✓ |
| queue:clinical (move to *With nurse/doctor*) | | ✓ | ✓ | |
| vitals:write, procedures:write | | ✓ | ✓ | |
| clinical:read | | ✓ | ✓ | |
| clinical:write (SOAP, Rx, labs, referrals) | | ✓ | | |
| labs:result | | ✓ | ✓ | |
| billing:read | ✓ | ✓ | | ✓ |
| billing:write, payments | ✓ | | | ✓ |
| invoices:void | ✓ | | | |
| claims:manage | ✓ | | | ✓ |
| cashup | ✓ | | | ✓ (own) |
| reports:view | ✓ | | | |
| stock:read / write | ✓ | ✓ / | ✓ / ✓ | |
| messages:send | ✓ | ✓ | ✓ | ✓ |
| admin:users, admin:settings, audit:view | ✓ | | | |

**Separation of duties:** the practice manager sees money, schedules and audit, but
**not clinical text**. Reception cannot read clinical notes. Only the signing doctor can
add addenda to their own notes.

## 5. Data protection

- **Field-level encryption** with AES-256-GCM and a random 96-bit IV per value. The
  format is `v1:<iv>:<tag>:<ciphertext>`. It covers subjective, objective, assessment,
  plan, addenda, lab clinical info and results, and referral letters. Keys come from
  `FIELD_ENCRYPTION_KEYS` and the version prefix allows rotation. Key loss means data
  loss, so the key is backed up separately from DB backups, offline (printed QR in the
  practice safe).
- Structured clinical data (ICD-10 codes, vitals) stays in plain columns so it can be
  reported. It is protected by DB access control and full-disk encryption on the
  server (LUKS / BitLocker), which is a deployment requirement.
- **"End-to-end" scope:** true E2E encryption isn't compatible with a shared clinical
  record that several clinicians read. What we implement is encryption in transit (TLS)
  plus at rest (disk and app-layer fields), so keys never sit in the DB.
- **Backups** are `pg_dump` output encrypted with `age` (public key on the server,
  private key offline) before upload to R2. An offshore copy is therefore ciphertext
  only.
- **Offline cache:** the IndexedDB data is minimal (today's working set, no SOAP
  notes) and wiped on logout and on idle-lock timeout over 8 h. Workstations must use
  OS disk encryption and individual OS logins.
- Messages to patients never contain clinical content.
- Error logs never include request bodies, so no PHI ends up in logs.

## 6. Audit

- Append-only `audit_log` with a SHA-256 hash chain (`hash = H(prev_hash ‖ row)`).
  DB triggers reject UPDATE/DELETE. The verification tool finds any break.
- Logged events: login success/failure, 2FA events, patient view/create/update, every
  clinical read (consultation open, print) and write, prescription print, allergy
  override, invoice create/void, payment, cash-up, claim batch, user/admin changes,
  exports.
- The audit view is available to ADM only. Logs are retained indefinitely, because
  they are part of the medical record.

## 7. Compliance: Zimbabwe Cyber and Data Protection Act [Ch. 12:07] and medical records

| Requirement | How we meet it |
|---|---|
| Health data is sensitive and may only be processed under a health professional's supervision | Clinical data is limited to DR/NU roles. ADM sees aggregates only. |
| Data controller licence (POTRAZ, 2024 regulations) | **Practice action:** obtain or renew the licence and appoint a Data Protection Officer. |
| Cross-border transfer (s.28–29) | Primary data stays on-premise in Zimbabwe. Offsite backups are encrypted ciphertext. If a cloud host outside Zimbabwe is chosen, the practice must complete POTRAZ transfer requirements first. |
| Security safeguards | Everything in §2–§6. |
| Data subject rights (access, correction) | Patient record print/export. Corrections are audited, never silent overwrites. |
| Consent for communications | `comms_consent` flag with opt-out. Nothing is sent without it. |
| Medical record retention | No hard deletes of clinical or financial records. Void/cancel with a reason. |

> The practice should confirm current obligations with a local legal advisor. This
> table is engineering guidance, not legal advice.

## 8. Secure development checklist (Phase 8 gate)

- [ ] All routes use the `route()` wrapper (lint check: no raw `export async function POST` outside it)
- [ ] Zod validation on every body and query
- [ ] Drizzle parameterised queries only. No string-built SQL from user input.
- [ ] Clinical endpoints return 403 for ADM/RC (integration test)
- [ ] Encrypted columns verified to hold `v1:` ciphertext (integration test)
- [ ] Audit chain verification test, plus the trigger-blocks-update test
- [ ] CSP has no `unsafe-eval` in production
- [ ] `npm audit --omit=dev` shows no high or critical issues
- [ ] Secrets only from env; `.env*` git-ignored
- [ ] Backup restore drill documented and performed
