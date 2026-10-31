# Prompt: critique ZimMedPractice (give this whole file to the reviewing AI)

---

You are a senior reviewer with three hats: **clinical informatics specialist**, **product/UX designer**, and **application security engineer**. You are reviewing **ZimMedPractice**, a web-based electronic health record (EHR) and practice-management system for a small private medical practice in Zimbabwe: **3 doctors, 2 nurses, 1 receptionist and 1 practice manager**.

Your job is to critique it honestly and specifically. I want problems found, not praise. If something is good, say so in one line and move on.

## 1. Ground rules

1. **Do not modify the code.** Read, run and test only. Report findings; do not fix them.
2. **Separate what you verified from what you assumed.** Label every finding `VERIFIED` (you reproduced it in the running app or read the exact code) or `ASSUMED` (inferred). Never present a guess as a fact.
3. **Be specific.** Give the screen or URL, the file and line where relevant, the role you were signed in as, and exact steps to reproduce.
4. **Do not invent features.** If something is not built, say "not built", not "broken". See section 3 for what is known to be unfinished.
5. **Do not use real patient data.** Everything here is demo data.
6. Judge it against the needs of **this** practice, not a hospital or a US EHR: busy morning queues, load-shedding and unreliable internet, USD and ZiG (Zimbabwe Gold) side by side, medical aid societies (CIMAS, PSMAS, First Mutual, etc.), WhatsApp as the main patient channel, and the Zimbabwe Cyber and Data Protection Act.

## 2. How to run it

```bash
cd SurgeryManager
npm install
npm run setup        # creates .env.local with secrets, migrates, seeds demo data (no database install needed)
npm run dev          # http://localhost:3000
npm test             # 48 unit/integration tests
npm run e2e          # browser tests on a separate server and database (port 3100)
npm run db:reset     # wipe and reseed the dev database
```

Requires Node 20.9+. The code is Next.js 16 (App Router, TypeScript), PostgreSQL via Drizzle (an embedded PGlite database in development), Better Auth for sign-in, and Tailwind for styling.

**Read the project's `AGENTS.md` first.** This Next.js version has breaking changes from older versions, and the bundled docs are in `node_modules/next/dist/docs/`.

### Demo accounts (development only, all share one password: `Zimmed-Demo-2026!`)

| Access level | Username |
|---|---|
| Practice manager | `manager` |
| Doctor | `dr.moyo`, `dr.ncube`, `dr.chikore` |
| Nurse | `sr.dube`, `sr.mutasa` |
| Reception | `reception` |

Two-factor authentication is off in the demo. The sign-in throttle is in memory: 5 wrong passwords for one username locks it for 15 minutes, and restarting the dev server clears it. Use a separate browser profile per role so sessions don't collide.

## 3. What is and isn't built

The project follows `docs/PLAN.md` in 8 phases. **Phases 0–4 are done.** Judge those. **Phases 5–8 are not built.** Do not report them as bugs, but do tell me if the existing design will make them hard.

| Built (review these) | Not built yet (don't report as bugs) |
|---|---|
| Sign-in, roles and permissions, idle screen lock, password change, 2FA enrolment | WhatsApp/SMS reminders, chronic recalls, "results ready" messages (Phase 5) |
| Patient registration, search, patient file, alert banner (allergies and chronic conditions), medical aid verification | Offline service worker and app-shell caching (Phase 6). The offline outbox and sync indicator code exists, but only partly wired. |
| Appointment book, check-in, live waiting-room board | Reports and analytics, stock management screens, administration (users, settings, audit viewer), messages page (Phase 7). **The sidebar already links to these pages and they currently return 404; judge that choice.** |
| Triage vitals with abnormal-value flags, procedures and injections log | Backups, deployment guide, CI (Phase 8) |
| SOAP consultation with autosave and signing, ICD-10 search, prescriptions with allergy check, lab and imaging orders, referral letters, printable documents, visit summary, lab inbox | |
| Billing: tariffs, daily exchange rate, invoices with medical aid / shortfall split, multi-currency payments with change, receipts, cash-up, claim batches (CSV, email, remittance) | |

Read these before judging, so you know the intended design and acceptance criteria:
`docs/PLAN.md` (phases and decision log D1–D23), `docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/THIRD_PARTY.md`, `docs/DEMO_ACCOUNTS.md`.

## 4. Review each user's day

Sign in as each role and **actually do their job**. For each role, follow the script, then critique. Time yourself on the busy-queue tasks: if a nurse needs more than about 5 clicks to record vitals, say so.

### 4.1 Receptionist (`reception`)
Script: register a new patient (with medical aid, then a cash patient); try a duplicate; search by name, phone and national ID; book an appointment; try to double-book a doctor; check a patient in as a walk-in and from an appointment; move cards on the waiting-room board; create and pay an invoice in USD cash, then in ZiG, then split USD swipe plus ZiG cash with change; set the exchange rate; do the end-of-day cash-up; create a medical aid claim batch.
Ask: Can they run the front desk without help at 8 am with 15 people waiting? What would make them make a mistake (wrong patient, wrong currency, wrong change)? What can't they see that they need? What can they see that they shouldn't?

### 4.2 Nurse (`sr.dube`)
Script: open the board, take a patient to triage, record vitals (try an implausible value, a high BP, missing height/weight), record an injection from stock, see that stock goes down, enter a lab result.
Ask: Is vitals entry fast enough on a tablet or small laptop? Are abnormal flags clear without being alarming? Can a nurse accidentally put a patient with the wrong doctor? Are the stock controls enough?

### 4.3 Doctor (`dr.moyo`, `dr.ncube`, `dr.chikore`)
Script: open a triaged patient, read the history sidebar, write a SOAP note (watch the autosave), pick ICD-10 codes, prescribe a drug the patient is allergic to (use the demo patient with a penicillin allergy), then override with a reason, order labs, write a referral from the draft, print the prescription, sign the note, add an addendum, then try to edit the signed note. Try opening another doctor's consultation.
Ask: Does the screen suit a 10-minute consultation, or is it too much scrolling? Is the allergy warning impossible to miss and impossible to click through by reflex? Is the ICD-10 list enough for general practice? Are the prescription defaults safe (doses, durations)? Is the printed prescription something a Zimbabwean pharmacist would accept? Is anything clinically dangerous or misleading?

### 4.4 Practice manager (`manager`)
Script: look at billing, cash-up for all cashiers, claims, tariffs and exchange-rate history. Try to open any clinical page (it should refuse). Try to void an invoice (with and without payments).
Ask: Does the manager get the financial control they need (variances, who changed what)? Is the separation of duties right? Which of the not-yet-built screens (reports, audit, users, stock) are the most urgent for this role, and why?

### 4.5 Cross-role checks
- For every role, try pages and API endpoints that role should **not** reach, by typing URLs (`/labs`, `/billing`, `/api/visits/<id>/consultation`, `/api/patients/<id>/history`). Record the response codes.
- Sign out and use the back button. Leave a screen idle for 10 minutes and check the lock.

## 5. Critique dimensions (apply to every screen and feature)

For each, give a short verdict and your evidence.

1. **Usability and speed:** clicks and keystrokes for the common task, error messages, empty states, what happens on a slow or lost connection, keyboard use, mistakes that are easy to make.
2. **Visual design and layout:** hierarchy, density, contrast, consistency, and whether it works on a 1366×768 laptop, a tablet and a phone. Run an accessibility check against WCAG 2.1 AA (contrast, labels, focus order, keyboard-only use, screen-reader names, colour used as the only signal).
3. **Clinical safety:** anything that could lead to wrong-patient, wrong-drug, wrong-dose or missed-result errors; unclear status of results; unsafe defaults.
4. **Correctness of money:** rounding, change, ZiG conversion and the rate used, aid versus patient portions, partial payments, voids, cash-up totals.
5. **Security and privacy:** authentication and session handling, authorisation on every endpoint, input validation, injection and cross-site risks, secrets handling, encryption of clinical text, audit completeness (can anything sensitive be read without an audit entry?), error messages that leak data, headers and CSP, and the offline cache's handling of patient data.
6. **Legal and compliance:** fit with the Zimbabwe Cyber and Data Protection Act, the medical-records retention expectation, and the HPZ/MDPCZ registration rule on prescriptions. Say what is missing; do not give legal advice as fact.
7. **Data model and code quality:** schema problems, missing indexes or constraints, race conditions (double check-in, double payment, concurrent audit writes), transaction boundaries, error handling, dead code, test gaps. Name the exact file and line.
8. **Fit with the brief:** compare against the original requirements in `docs/FEATURES.md`. List every requirement that is missing, partial, or met in a way that doesn't help the real user.
9. **Resilience:** what happens during load-shedding, a browser refresh mid-form, two people editing the same record, a double-click on "Pay", or the server restarting.

## 6. Also try to break it

Spend real effort here. Examples: oversized inputs, special characters and emoji in names, a date of birth in the future, negative or huge payment amounts, paying twice with the same idempotency key, a tampered request (change another patient's ID), cross-site form posts, opening the same invoice in two tabs, signing a note in two tabs, a cash-up with no payments, a patient with a very long name on a printed script.

## 7. How to report

Write one Markdown report with these sections, in this order:

1. **Verdict (5 lines max):** is this safe and useful enough for a pilot at the practice? What are the 3 things that must change first?
2. **Findings table:** `ID | Severity | Role/Area | What's wrong | How to reproduce | Evidence | VERIFIED/ASSUMED | Suggested fix`.
   Severity: **Critical** (patient harm, data exposure, money loss), **High** (blocks a core task or likely causes errors), **Medium** (slows or confuses), **Low** (polish).
3. **Per-role review:** one short section for each of reception, nurse, doctor and practice manager. What works, what hurts, what is missing. Include your task timings.
4. **Per-feature scorecard:** every feature in section 3's "Built" column, scored 1–5 for usability, safety and completeness, with one sentence each.
5. **Missing or wrong versus the brief:** a list.
6. **Design suggestions:** at most 10, ranked by value to the practice. Include at least two bold ideas, not only fixes.
7. **What I could not check:** things you did not or could not test, and why.

Keep the whole report under about 4,000 words. Lead with the most serious problems. Don't pad.
