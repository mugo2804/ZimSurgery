# ZimMedPractice — Implementation Plan

This is the controlling document for the build. Work proceeds phase by phase, in order.
A phase is done only when every item in its **Definition of Done** passes. Any change
to scope or technology is recorded in the [Decision Log](#decision-log) before code
changes.

Companion documents:

| Document | Purpose |
|---|---|
| [FEATURES.md](FEATURES.md) | Functional specification and acceptance criteria per module |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technology stack, structure, data model, offline design |
| [SECURITY.md](SECURITY.md) | Threat model, controls, compliance (Zimbabwe CDPA) |
| [THIRD_PARTY.md](THIRD_PARTY.md) | Every external service, its free tier, limits and caveats |

---

## 1. Goals

1. A secure, fast EHR and practice-management web app for a Zimbabwean private practice
   with 3 doctors, 2 nurses, front desk and a practice manager.
2. **It keeps working during ZESA load-shedding and internet outages.** The primary
   deployment is an on-premise server on UPS. Browsers are installable PWAs with an
   offline outbox.
3. **No paid software licences.** Every library is open source, and every hosted service
   is used on a free tier. The few unavoidable per-use costs (WhatsApp template
   messages, SMS airtime) are isolated, optional and documented.
4. Clinical data is encrypted at rest, every access is audited, and the design meets the
   Cyber and Data Protection Act [Chapter 12:07].

## 2. Non-goals (v1)

- Direct electronic claim switching to medical aids. The aids' APIs aren't public, so
  v1 produces claim batch files and emails them.
- Pharmacy dispensing and stock valuation accounting. Stock logging is included.
- A patient-facing portal, telemedicine, or multi-branch tenancy.
- Lab result interfaces (HL7/ASTM). Results are entered or attached manually.

## 3. Technology summary

Details and justification are in [ARCHITECTURE.md](ARCHITECTURE.md).

| Concern | Choice | Licence/cost |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript, Turbopack) | MIT |
| UI | Tailwind CSS 4, hand-rolled components, Recharts | MIT |
| Database | **PostgreSQL 16+** in production, **PGlite** (in-process Postgres) for dev and tests | PostgreSQL licence / Apache-2.0 |
| ORM and migrations | Drizzle ORM and drizzle-kit | Apache-2.0 |
| Auth | **Better Auth** (self-hosted): username/password, TOTP 2FA, DB sessions, rate limiting | MIT |
| Validation | Zod 4 | MIT |
| Offline | Serwist service worker, Dexie (IndexedDB) cache and outbox | MIT / Apache-2.0 |
| Real-time queue | Server-Sent Events from a Route Handler (no external service) | — |
| WhatsApp | Meta WhatsApp Cloud API direct, plus a free `wa.me` click-to-chat fallback | Free API; per-message template fees |
| SMS | **SMS Gateway for Android** (practice phone and SIM) | Apache-2.0; airtime only |
| Email (claims) | Nodemailer over any SMTP (Brevo free tier suggested) | MIT / free tier |
| Remote access and TLS | Caddy (auto HTTPS) and **Cloudflare Tunnel** (free) | Apache-2.0 / free |
| Backups | `pg_dump`, encrypted with `age`, uploaded to **Cloudflare R2** free tier | free tier |
| Tests and CI | Vitest, Playwright, GitHub Actions | MIT / free |

## 4. Phases

### Phase 0: Planning and documentation ✅
- Write PLAN, FEATURES, ARCHITECTURE, SECURITY, THIRD_PARTY and README.

**DoD:** The documents exist and agree with each other.

### Phase 1: Foundation ✅
1. Scaffold Next.js 16 (TypeScript strict, App Router, `src/`), Tailwind 4, ESLint.
2. Write the Drizzle schema for every table in ARCHITECTURE §5, plus migrations.
3. Add a DB driver switch: PGlite when `DATABASE_URL` is unset, otherwise postgres.js.
4. Add `lib/crypto.ts` (AES-256-GCM field encryption, key versioning).
5. Configure Better Auth: username login, TOTP 2FA, DB sessions, idle timeout,
   lockout and rate limits. Enforce 2FA for admin and doctor roles.
6. Write `lib/rbac.ts` (permission matrix from SECURITY §4) and `lib/api.ts`
   (authenticated route wrapper: session, permission, Zod validation, idempotency,
   error mapping).
7. Write `lib/audit.ts` (hash-chained, append-only audit log, with DB triggers that
   block UPDATE/DELETE).
8. Build the app shell: login, 2FA challenge, role-filtered sidebar, top bar
   (connectivity, exchange rate, user), idle lock screen.
9. Add a seed script: practice settings, users (3 doctors, 2 nurses, reception,
   admin), medical aids, tariffs, ICD-10 subset, medicines, labs, stock, demo
   patients.
10. Add security headers (CSP, HSTS, frame-ancestors, referrer, permissions) in
    `next.config.ts`, and auth gating in `proxy.ts`.

**DoD:** `npm run dev` works with zero external installs. Each role can log in and sees
only its own menu. Unit tests pass for crypto, RBAC and the audit chain.

### Phase 2: Patients and front desk ✅
1. Patient registration and edit, with national ID validation, medical aid details,
   next of kin, comms consent, allergies and chronic conditions.
2. Patient search by name, file number, national ID, phone or medical aid number.
3. Patient file with a persistent **allergy and chronic alert banner**.
4. Appointment book: day view per doctor, booking, rescheduling, cancel, DNA,
   double-booking warning.
5. Check-in: from an appointment or walk-in, creating a visit.
6. **Waiting-room board**: columns *Checked in → Triage done → With nurse → With
   doctor → Billing → Completed*, live over SSE with polling fallback, and waiting
   times.
7. Medical aid verification record (who verified, when, how).

**DoD:** FEATURES §A and §B acceptance criteria pass. Patient views are audited.

### Phase 3: Clinical workstation ✅
1. Triage form with BMI auto-calculation, abnormal-value flags, and push to the doctor
   (visit moves to *Triage done*).
2. Nurse procedures and immunisations log, with optional stock deduction.
3. SOAP consultation: autosaved drafts, vitals panel, history sidebar, sign and lock,
   and addenda after signing.
4. ICD-10 search (bundled code set), primary and secondary diagnoses.
5. E-prescription builder: medicine formulary search, an **allergy conflict check**
   (blocking warning that needs a reason to override), and a printable script showing
   the HPZ number and a stamp area.
6. Lab and imaging requisitions (Lancet, PathCare, NPRS and others), printable, with
   results entry.
7. Referral letters, printable.
8. Follow-up date that creates a recall/appointment suggestion.

**DoD:** FEATURES §C acceptance criteria pass. Clinical text is verified encrypted in
the DB. Reception and admin get 403 on clinical endpoints.

### Phase 4: Billing, medical aids and claims ✅
1. Tariff management: cash price, default medical aid price, per-society overrides.
2. Exchange rate register (ZiG per USD, effective time, source).
3. Invoice builder per visit: tariff items with ICD-10 linkage, and a cash vs medical
   aid split (aid portion and patient shortfall).
4. Multi-currency POS: USD cash, ZiG cash, Swipe (ZimSwitch), EcoCash, InnBucks, bank
   transfer. Split tenders, change calculation, the rate captured per payment, and
   receipts.
5. End-of-day **cash-up**: totals per method and currency, per cashier, expected vs
   declared cash, variance, and a printable report.
6. Claims: pending aid invoices by society, batch creation, CSV export, email dispatch,
   status tracking, and remittance capture (paid or rejected per invoice).

**DoD:** FEATURES §D acceptance criteria pass. Money calculations are unit-tested,
including ZiG conversion and rounding.

### Phase 5: Patient engagement
1. Messaging provider abstraction: `whatsapp-cloud`, `sms-android-gateway`,
   `click-to-chat` (manual) and `log` (dev).
2. Appointment confirmation on booking, and a reminder 24 h before (once only).
3. Chronic recall engine: interval per patient, due list, bulk send.
4. "Results ready" notification (no clinical content in the message).
5. Scheduler: an in-process interval, plus a `/api/cron/*` endpoint protected by a
   secret for an external trigger.
6. Message log with delivery status, and consent and opt-out handling.

**DoD:** FEATURES §E acceptance criteria pass. No message body contains a diagnosis or
result.

### Phase 6: Offline-first
1. Serwist service worker: precache the app shell, network-first for pages,
   stale-while-revalidate for reference data.
2. Dexie cache: today's queue, today's appointments, patients on today's list, and
   reference data. Wiped on logout.
3. Outbox: offline writes (check-in, vitals, procedures, patient registration, queue
   moves, stock log) are queued with client UUIDs and an `Idempotency-Key`, then
   replayed in order when back online, with conflict reporting.
4. Connectivity and sync indicator showing pending outbox count and last sync time.

**DoD:** With the server unreachable, a nurse can record vitals and a receptionist can
register and check in a patient. Both sync without duplicates when the server comes
back (Playwright test).

### Phase 7: Analytics, stock and administration
1. Dashboard: footfall per day, revenue by currency (USD/ZiG), collections by method,
   patients per doctor, average waiting time, top 10 diagnoses, DNA rate.
2. Stock: items, batches and expiry, receive/issue/adjust, reorder alerts.
3. Admin: users (create, disable, reset password, reset 2FA), practice settings
   (name, address, AHFoZ practice number, phone), medical aids, tariffs.
4. Audit log viewer with filters and a **chain verification** button.

**DoD:** FEATURES §F and §G acceptance criteria pass.

### Phase 8: Hardening and deployment
1. Tests: unit (money, crypto, RBAC, audit, phone and ID validation), API integration
   against PGlite, and Playwright for the core flows.
2. Production `Dockerfile`-free deployment (Node standalone output, systemd unit),
   Caddyfile, Cloudflare Tunnel config.
3. Backup and restore scripts (`pg_dump` → `age` → R2), with a restore drill
   documented.
4. GitHub Actions: typecheck, lint, test and build.
5. Final security review against the SECURITY.md checklist.

**DoD:** CI is green, a restore drill succeeds on a fresh DB, and the SECURITY.md
checklist is complete.

## 5. Working rules

- Every mutating endpoint goes through `lib/api.ts`: auth, permission, Zod schema,
  audit and idempotency. There are no exceptions.
- Clinical free text is written only through `encrypt()` and read only through
  `decrypt()`, inside the service layer.
- Nothing is hard-deleted except drafts. Records are voided or cancelled, with a
  reason.
- Timestamps are stored in UTC. Display and day boundaries use Africa/Harare (UTC+2).
- Money is stored as integer cents (USD). ZiG amounts are stored as integer ZiG cents,
  together with the rate used.

## Decision log

| # | Date | Decision | Reason |
|---|---|---|---|
| D1 | 2026-10-30 | Next.js 16 full-stack; no separate backend service | User direction. One deployable unit is simpler to run on a practice server. |
| D2 | 2026-10-30 | Primary deployment is **on-premise** (server on UPS), with Cloudflare Tunnel for remote access | Load-shedding resilience: the LAN keeps working with no internet. Keeps health data in Zimbabwe (CDPA §28–29). |
| D3 | 2026-10-30 | Vercel Hobby **not** used for production | Vercel's Hobby plan is restricted to non-commercial personal use. |
| D4 | 2026-10-30 | Supabase free tier is optional, for demo/dev only | Free projects pause after ~7 days of inactivity and have no backups. Hosting offshore also needs CDPA transfer compliance. |
| D5 | 2026-10-30 | Better Auth (self-hosted) instead of a hosted auth SaaS | Sessions and users stay in our DB, it works offline on the LAN, and 2FA is free. |
| D6 | 2026-10-30 | PGlite for dev and tests | Zero-install Postgres. Same SQL dialect as production. |
| D7 | 2026-10-30 | REST Route Handlers are the single write path (not Server Actions) | Offline outbox replay needs stable URLs and idempotency keys. |
| D8 | 2026-10-30 | Exchange rate entered manually (daily) | There is no reliable free official ZiG rate API. The RBZ publishes rates on its website. |
| D9 | 2026-10-30 | SMS via an Android gateway app on a practice phone | No SMS aggregator is free. Using the practice SIM bundle is the cheapest option. |
| D10 | 2026-10-30 | `npm run setup` writes `ENFORCE_2FA=false` into the **dev-only** `.env.local`. The default everywhere else (and when unset) is enforced. | Lets the demo be explored without an authenticator app. Production must not set it. |
| D11 | 2026-10-30 | Login throttling uses two layers: Better Auth per-IP (10 sign-ins / 15 min, in memory) and an app-level per-username lockout (5 failures / 15 min) | SECURITY §2 asks for per IP+username. The in-memory store suits the single-server deployment. |
| D12 | 2026-10-30 | The Dexie store, outbox engine and sync indicator were created in Phase 1 because the top bar depends on them. Phase 6 wires the screens and service worker to them. | Ordering only. Scope unchanged. |
| D13 | 2026-10-30 | Added `qrcode` (MIT) for local 2FA QR rendering and `dexie-react-hooks` (Apache-2.0) | No external QR service: the TOTP secret never leaves the practice network |
| D14 | 2026-10-30 | Root layout calls `connection()` so every page renders dynamically | Required for the per-request CSP nonce (Next.js CSP guide). Static pages would be blocked by the CSP. |
| D15 | 2026-10-30 | Package-level `overrides` force `zod@4.6.7` inside Serwist. The 4 remaining moderate `npm audit` findings are drizzle-kit's dev-only esbuild. | Patched GHSA-mrhx-c7xc-m3w5. drizzle-kit is not shipped to production. |
| D16 | 2026-10-31 | AC C4 (printing blocked without an HPZ number) is enforced in the print page. Its automated test is a Playwright case in Phase 8, because it needs a rendered page. | Integration tests cover the service layer only |
| D17 | 2026-10-31 | Signing a consultation requires a primary ICD-10 diagnosis and at least a history or assessment. Signing moves the visit to *Billing*. | Gives billing a coded diagnosis (aid claims need ICD-10, AC D-series) and matches the queue flow |
| D18 | 2026-10-31 | Only the authoring doctor may edit a draft or add addenda. Other doctors get read-only access. | SECURITY §4 separation of duties; prevents silent edits to another clinician's note |
| D19 | 2026-10-31 | Billing staff can see a visit's **ICD-10 codes only** (no clinical narrative) | Aid claims need ICD-10 per line (FEATURES §D). This is the minimum disclosure needed, and it keeps SECURITY §4 intact. |
| D20 | 2026-10-31 | An invoice can be voided only when no payments are recorded against it and it is not in a claim batch. Items lock once any payment exists. | AC D4. Keeps cash-up totals and receipts immutable. Refunds are a separate future feature. |
| D21 | 2026-10-31 | Reception (billing:write) and the practice manager can record the daily exchange rate. Every change is audited. | The front desk opens the practice and must be able to take ZiG before the manager arrives |
| D22 | 2026-10-31 | Cash change is computed in the tender's own currency (tendered − amount it must cover), never by converting the USD excess back | A double-conversion bug found by tests short-changed patients ZiG 0.13. The server and POS preview now use the same rule. |
| D23 | 2026-10-31 | Claim CSV values are neutralised against spreadsheet formula injection. SMTP requires TLS. | Claim files are opened in Excel by aid administrators and contain PHI |
