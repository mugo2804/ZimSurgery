# ZimMedPractice — Architecture

## 1. Deployment topology (production)

```
                   ┌──────────── Practice LAN (works with no internet) ─────────────┐
 Reception PC ─┐   │  ┌─────────────────────────── Practice server (on UPS) ──────┐ │
 Nurse PC   ───┼──►│  │ Caddy :443 (HTTPS)  ──►  Next.js 16 (node, standalone)    │ │
 Doctor PCs ───┘   │  │                              │                            │ │
 (installed PWAs)  │  │                              ▼                            │ │
                   │  │                         PostgreSQL 16                     │ │
                   │  │ cloudflared (tunnel) ── nightly pg_dump → age → R2        │ │
                   │  └───────────────────────────────────────────────────────────┘ │
 Android phone ◄───┼── SMS Gateway app (practice SIM)                               │
                   └────────────────────────────────────────────────────────────────┘
                          │ when internet is up
                          ▼
     Cloudflare Tunnel (remote access for doctors) · Meta WhatsApp Cloud API · SMTP · R2
```

- **On-premise first.** When the internet drops, the whole practice keeps working on
  the LAN. When power drops, the UPS keeps the server and switch up. Workstations on
  laptops keep working through the PWA offline outbox.
- **HTTPS on the LAN.** A service worker needs a secure context, so Caddy obtains a
  real Let's Encrypt certificate for e.g. `ehr.example.co.zw` via the Cloudflare
  DNS-01 challenge. The LAN router/DNS resolves that name to the server's LAN IP
  (split DNS). The certificate renews whenever there is internet.
- **Remote access** (a doctor at home or in theatre) goes through Cloudflare Tunnel,
  optionally behind Cloudflare Access email OTP. No inbound ports are opened.
- **Alternative cloud deployment:** the same build runs on any Node host with Postgres,
  e.g. Oracle Cloud Always Free. Hosting outside Zimbabwe is a cross-border transfer
  under the CDPA. See SECURITY §7.

## 2. Application structure

```
src/
  app/
    (auth)/login, (auth)/two-factor        public pages
    (app)/layout.tsx                       authenticated shell (sidebar, topbar)
    (app)/dashboard, queue, patients, patients/[id], appointments,
          visits/[id]/triage, visits/[id]/consult, billing, billing/[invoiceId],
          cashup, claims, messages, reports, stock, admin/*
    print/rx/[id], print/lab/[id], print/referral/[id], print/invoice/[id], print/cashup
    api/auth/[...all]                      Better Auth handler
    api/**                                 REST route handlers (single write path)
    api/events/queue                       SSE stream
    api/cron/[job]                         secret-protected scheduler triggers
  server/                                  server-only code ("server-only" import)
    db/schema.ts, db/index.ts, db/migrate.ts, db/seed.ts
    auth.ts, rbac.ts, api.ts, audit.ts, crypto.ts, money.ts, events.ts
    services/*.ts                          domain logic (patients, visits, clinical, billing, claims, messaging, reports, stock)
    messaging/providers/*.ts               whatsapp-cloud, sms-android-gateway, log
    reference/icd10.ts, medicines.ts, labs.ts
  client/                                  browser-only code
    offline/db.ts (Dexie), offline/outbox.ts, offline/fetcher.ts
    components/*                           UI building blocks
  proxy.ts                                 auth gate for (app) routes (Next 16 "proxy", formerly middleware)
public/sw.js (built by Serwist from src/sw.ts)
```

### Request pipeline (`server/api.ts`)
Every Route Handler is wrapped with `route({ perm, body: zodSchema }, handler)`:
1. Resolve the Better Auth session. Without one, return 401. If 2FA is required but
   not verified, return 401 too.
2. Check RBAC permission, or return 403.
3. On writes, check `Idempotency-Key` and return the stored response on replay.
4. Parse and validate the body with Zod, or return 400 with field errors.
5. Run the handler inside a DB transaction. The audit entry is written in the same
   transaction.
6. Map domain errors to HTTP. Clients never see stack traces.

Reads for pages happen in Server Components through the same services, after the same
permission checks (`requirePage(perm)`).

## 3. Real-time queue

`server/events.ts` holds an in-process `EventEmitter`. Services emit
`queue.changed` with `{visitId}` only, never PHI. `GET /api/events/queue` streams these
as SSE, and clients refetch the board. Polling every 15 s is the fallback. On a
multi-instance deployment this would move to Postgres `LISTEN/NOTIFY`. That isn't
needed for a single practice server.

## 4. Offline-first design

| Layer | Behaviour |
|---|---|
| Service worker (Serwist) | Precaches the app shell and static assets. Pages are network-first with a cached fallback. `/api/reference/*` is stale-while-revalidate. Other `/api` requests are never cached by the SW. |
| Dexie cache | Holds today's queue, today's appointments, the patients on them, and reference data. It is written after each successful fetch, read when offline, and **cleared on logout**. |
| Outbox | Offline-capable writes go into the `outbox` table: method, URL, body, `Idempotency-Key`, createdAt. Records carry **client-generated UUIDs**, so a patient registered offline can be checked in offline. A replay worker runs in FIFO order on `online` and every 30 s. A 4xx result marks the entry *conflict* and shows it to the user. A 5xx result or a network error retries with backoff. |
| Server | Accepts client UUIDs as primary keys. The `idempotency_keys` table stores (key, user, status, body) for 7 days. |

Offline-capable writes: patient create/update, check-in, queue status, vitals,
procedures and stock movements. Consultation signing, billing and payments require the
server. Money and signatures must not fork.

## 5. Data model (PostgreSQL)

IDs are `uuid`. Timestamps are `timestamptz`. Money is `integer` cents.
⚿ = encrypted text (AES-256-GCM, app layer).

| Table | Key columns |
|---|---|
| `user`, `session`, `account`, `verification`, `two_factor` | Better Auth tables, plus `user.role`, `user.username`, `user.hpzNumber`, `user.qualification`, `user.title`, `user.active` |
| `settings` | key, value |
| `sequences` | name, value (human-readable numbers: ZMP-, RX-, LAB-, REF-, INV-, RCT-, CLM-) |
| `medical_aids` | name, code, claims_email, phone, active |
| `patients` | file_no, names, dob, sex, national_id, phone, whatsapp, email, address, city, occupation, nok_*, medical_aid_id, ma_member_no, ma_principal_name, ma_dependant_code, ma_verified_at/by/method, allergies jsonb, allergy_status (`unknown`/`nka`/`recorded`), chronic_conditions jsonb, recall_interval_months, last_recall_at, comms_consent, preferred_channel |
| `appointments` | patient_id, doctor_id, start_at, duration_min, reason, status, reminder_sent_at, confirmation_sent_at |
| `visits` | patient_id, doctor_id, appointment_id, status, priority, payer_type, complaint, checked_in_at, status_changed_at, completed_at |
| `visit_status_log` | visit_id, status, user_id, at |
| `vitals` | visit_id, patient_id, bp_sys, bp_dia, pulse, resp_rate, temp_c, spo2, weight_kg, height_cm, bmi, glucose, pain_score, notes, recorded_by |
| `procedures` | visit_id, patient_id, item, dose, route, site, batch_no, stock_item_id, given_by |
| `consultations` | visit_id (unique), patient_id, doctor_id, subjective⚿, objective⚿, assessment⚿, plan⚿, follow_up_date, status (draft/signed), signed_at |
| `consultation_addenda` | consultation_id, author_id, text⚿ |
| `diagnoses` | consultation_id, patient_id, code, description, is_primary |
| `prescriptions` / `prescription_items` | rx_no, consultation_id, patient_id, doctor_id, allergy_override_reason / medicine, strength, form, dose, frequency, duration, quantity, instructions |
| `lab_orders` | order_no, consultation_id, patient_id, doctor_id, lab, tests jsonb, clinical_info⚿, urgency, status, result⚿, resulted_at/by |
| `referrals` | ref_no, consultation_id, patient_id, doctor_id, to_name, to_specialty, to_facility, urgency, letter⚿ |
| `tariffs` / `tariff_aid_rates` | code, description, category, cash_cents, aid_cents / tariff_id, medical_aid_id, aid_cents |
| `exchange_rates` | zig_per_usd (numeric 12,4), source, effective_at, set_by |
| `invoices` / `invoice_items` | invoice_no, visit_id, patient_id, payer_type, medical_aid_id, member_no, dependant_code, total_cents, aid_cents, patient_cents, paid_cents, status, claim_status, claim_batch_id, claim_paid_cents, void_reason / code, description, icd10, qty, unit_cents, aid_unit_cents, total_cents, aid_total_cents |
| `payments` | receipt_no, invoice_id, patient_id, method, currency, amount_minor, zig_rate, usd_cents, reference, received_by, received_at |
| `cashups` | day, cashier_id, expected jsonb, declared_usd_cents, declared_zig_cents, variance jsonb, notes |
| `claim_batches` | batch_no, medical_aid_id, status, total_cents, paid_cents, emailed_at, submitted_at, paid_at |
| `stock_items` / `stock_movements` | name, category, unit, qty, reorder_level, batch_no, expiry_date / item_id, change, reason, visit_id, user_id |
| `messages` | patient_id, appointment_id, channel, to_number, kind, body, status, provider, provider_ref, error, sent_at |
| `audit_log` | seq bigserial, at, user_id, username, role, action, entity, entity_id, patient_id, details jsonb, ip, prev_hash, hash. Triggers block UPDATE/DELETE. |
| `idempotency_keys` | key, user_id, status, body, created_at |

## 6. Money

- USD is the unit of account. All prices are in USD cents.
- `money.ts` holds `splitAid(lines)`, `zigToUsdCents(zigCents, rate)`,
  `usdToZigCents(usdCents, rate)` and `formatUSD`/`formatZiG`. It is pure and
  unit-tested.
- Rounding is half away from zero, applied once at conversion. Allocation never loses
  cents, so aid + patient = total.

## 7. Scheduling

`instrumentation.ts` (the Next.js server startup hook) starts an in-process interval
every 15 min while `SCHEDULER=on`. It runs reminders, recalls and idempotency-key
cleanup. Each job is also exposed as `POST /api/cron/{job}` with a `CRON_SECRET`
header, so a system cron or GitHub Actions can trigger it instead.

## 8. Environments

| | Dev | Test | Production |
|---|---|---|---|
| DB | PGlite file at `.data/pglite` | PGlite in-memory | PostgreSQL 16 |
| Messaging | `log` provider | `log` | configured providers |
| Secrets | auto-generated `.env.local` by `npm run setup` | fixed test keys | env vars / systemd credentials |

## 9. Key environment variables

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FIELD_ENCRYPTION_KEYS`
(`v1:<base64 32 bytes>[,v2:…]`), `CRON_SECRET`, `SCHEDULER`,
`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_REMINDER`,
`WHATSAPP_TEMPLATE_RECALL`, `WHATSAPP_TEMPLATE_RESULTS`, `WHATSAPP_TEMPLATE_CONFIRM`,
`SMS_GATEWAY_URL`, `SMS_GATEWAY_USER`, `SMS_GATEWAY_PASSWORD`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
