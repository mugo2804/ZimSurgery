# Prompt 1 of 3: UI and UX critique of ZimMedPractice (give this whole file to the reviewing AI)

This is the UI-focused prompt. The wider review (every feature, security, money correctness) is in `CRITIQUE_PROMPT.md`. Do only the UI and UX work described here.

---

You are a senior **product designer and accessibility specialist** with experience in clinical software used under time pressure. You are reviewing the **user interface** of **ZimMedPractice**, an electronic health record and practice-management web app for a small private practice in Zimbabwe: 3 doctors, 2 nurses, 1 receptionist, 1 practice manager.

I want an honest, specific design critique. Find what slows people down, confuses them, or could cause a mistake. Praise only briefly.

## 1. Ground rules

1. **Do not change the code.** Look, click, measure and report.
2. **Look at it running, not just in code.** Take screenshots, resize the window, use only the keyboard, zoom to 200%. Label each finding `VERIFIED` (you saw it) or `ASSUMED` (inferred from code).
3. **Name the screen, the URL, the role, and the viewport** for every finding, and say how to see it.
4. **Do not report unbuilt screens as bugs.** Pages for messages, stock, reports and administration are not built yet (section 3).
5. Design for this practice, not a hospital: busy morning queues, nurses and doctors typing quickly, shared reception computers, modest laptops and tablets, bright rooms, patchy internet, and amounts shown in both US dollars and ZiG.

## 2. Run it

```bash
npm install
npm run setup        # secrets, migrations, demo data; no database install needed
npm run dev          # http://localhost:3000
```

Read `AGENTS.md` first (this Next.js version differs from older ones). Demo accounts all use the password `Zimmed-Demo-2026!`:

| Role | Username |
|---|---|
| Practice manager | `manager` |
| Doctor | `dr.moyo`, `dr.ncube`, `dr.chikore` |
| Nurse | `sr.dube`, `sr.mutasa` |
| Reception | `reception` |

Use a separate browser profile per role. Five wrong passwords lock a username for 15 minutes; restarting the dev server clears that. Two-factor is off in the demo, and you can view its screens at `/setup-2fa` only if the setting is on.

**Design system, for reference:** one stylesheet, `src/app/globals.css` (Tailwind 4). System fonts only, 15px base text, brand blue `#0b5cad`, dark navy sidebar, shared classes `.btn`, `.input`, `.card`, `.badge`, `.table`. Layout shell: `src/components/shell/` (sidebar, top bar, idle lock). Check whether the design is consistent with itself.

## 3. Screens to review

Review **every built screen** below, in the role named. Some need data: use the demo patients (Tapiwa Chiweshe has a severe penicillin allergy and chronic conditions; Nyasha Mukwena has asthma) and create more as needed.

| Area | URL | Review as |
|---|---|---|
| Sign in, lock screen | `/login`, idle lock after 10 minutes | anyone |
| Access denied | `/forbidden` | reception → open `/labs` |
| Dashboard | `/dashboard` | all four roles (compare menus) |
| Waiting room board | `/queue` | reception, nurse, doctor |
| Appointment diary | `/appointments` | reception |
| Patient list, search | `/patients` | reception |
| Register / edit patient | `/patients/new`, `/patients/<id>/edit` | reception |
| Patient file | `/patients/<id>` | reception, doctor |
| Check-in dialog | button on patient file or board | reception |
| Triage and procedures | `/visits/<id>/triage` | nurse |
| Consultation workstation | `/visits/<id>/consult` | doctor |
| Visit summary | `/visits/<id>` | doctor, nurse |
| Lab results inbox | `/labs` | nurse, doctor |
| Billing worklist and exchange rate | `/billing` | reception, manager |
| Invoice and payment screen | `/billing/<invoiceId>` | reception |
| Tariffs | `/billing/tariffs` | manager, reception (read only) |
| Cash-up | `/cashup` | reception, manager |
| Claims list and batch | `/claims`, `/claims/<id>` | reception, manager |
| My account | `/account` | all |
| Printed documents | `/print/rx/<id>`, `/print/lab/<id>`, `/print/referral/<id>`, `/print/receipt/<id>`, `/print/cashup` | doctor, reception |

**Known unbuilt (do not report as broken, but judge the choice):** the sidebar already links to `/stock`, `/reports`, `/admin`, `/admin/audit` and `/messages`, which currently return 404.

## 4. What to check on every screen

### 4.1 Task speed and flow
- Count clicks and keystrokes for the main job (for example: register and check in a patient; record vitals; write, sign and print a prescription; take a split USD and ZiG payment). Report the numbers.
- Is the next action obvious? Is the primary button clearly primary? Is there a dead end?
- Can the most frequent actions be done with the keyboard only (Tab, Enter, Esc)? Do dialogs trap focus and close with Esc?
- What happens after saving: where does the user land, and do they know it worked?

### 4.2 Information design
- Hierarchy: what draws the eye first, and is it the right thing?
- Density: too sparse (wasted scrolling) or too dense (hard to scan)? Judge the consultation screen and the waiting-room board especially.
- Labels, wording and units. Are terms right for a Zimbabwean practice (HPZ/MDPCZ registration, medical aid, dependant code, ZiG)? Any jargon the receptionist would not know?
- Dates, times and money formats: consistent, unambiguous, local (day/month order, 24-hour time, `US$` and `ZiG`)?

### 4.3 Clinical-safety signals in the interface
- The allergy and chronic-condition banner: is it visible on every patient screen, impossible to miss, and not so loud it is ignored? Does "Allergies not recorded" read differently from "No known allergies"?
- The prescription allergy conflict: is the warning clear, and is the override deliberate rather than a reflex click?
- Abnormal vital-sign flags: clear without colour alone? Do they read correctly to a colour-blind user?
- Patient identity: on any screen where a mistake could mean the wrong patient, is the name, age and file number always visible?
- Signed versus draft notes: is the state unmistakable?

### 4.4 Money screens
- Can the receptionist tell at a glance: total, what the aid pays, what the patient owes, what has been paid, what is left?
- On the payment form: is it obvious which currency each amount is in, what the exchange rate is, and what change to give back (and in which currency)? What stops a wrong-currency entry?
- Do the printed receipt and cash-up read clearly on paper and in black and white?

### 4.5 States and feedback
For each screen, look for and judge: **empty** (no data yet), **loading**, **error** (stop the dev server mid-use, or send bad input), **success**, **offline** (browser dev tools → offline), **partial** (some fields missing), **long text** (a 60-character surname, a long complaint), and **many rows** (30 patients on the board, 100 invoices).

### 4.6 Accessibility (WCAG 2.1 AA)
Check and report:
- Colour contrast of text, badges, placeholder text, disabled controls and the sidebar (measure, don't guess).
- Visible focus on every control; logical Tab order; no keyboard traps.
- Every input has a programmatically linked label; errors are announced and linked to their field; required fields are identifiable.
- Meaning conveyed by colour alone (badges, board borders, vital flags).
- Touch targets of at least 44px on tablet; text legible at 200% zoom with no horizontal scroll on forms.
- Landmarks and headings; dialogs have a name and `aria-modal`; live regions for saves, errors and board updates.
- Test at least once with a screen reader (VoiceOver on macOS) on the patient form and the invoice screen.
- Respect for reduced motion and for the browser's text size.

### 4.7 Responsive layout
Test at **1920×1080, 1366×768, 1024×768 (tablet landscape), 768×1024 (tablet portrait), 390×844 (phone)**. Pay special attention to: the six-column waiting-room board, the appointment grid (it has a minimum width), the consultation screen with its history sidebar, the invoice table, and the sidebar and its mobile menu.

### 4.8 Consistency and polish
- Same action, same wording, same place on every screen? Same button styles and spacing? Do icons match their meaning?
- Confirmations: are destructive actions (cancel appointment, void invoice, discard queued change) confirmed in a consistent way? (Some use the browser's `confirm`/`prompt`; judge that.)
- Page titles, favicon and the browser tab. Does the app feel like one product?

### 4.9 Print
Print preview each printed document to paper size (A4; the prescription is also meant to suit A5). Check margins, page breaks, the practice stamp box, the HPZ/MDPCZ number, and that on-screen-only controls are hidden. Is the prescription something a Zimbabwean pharmacist would accept at a glance?

## 5. Role-by-role question

For each role, answer in 3–5 sentences: **If this person used the app for a full shift, what would frustrate them most, and what is the one change that would help them most?** Roles: reception, nurse, doctor, practice manager.

## 6. Report format

One Markdown report, in this order:

1. **Verdict (5 lines max):** is the interface ready for a pilot? Top 3 UI problems to fix first.
2. **Findings table:** `ID | Severity | Screen / URL | Role | Viewport | Problem | How to see it | VERIFIED/ASSUMED | Suggested fix`.
   Severity: **Critical** (could cause a clinical or money error), **High** (blocks or badly slows a core task, or fails accessibility on a core screen), **Medium** (confusing or inconsistent), **Low** (polish).
3. **Task timings:** a table of the tasks you timed or counted, per role.
4. **Accessibility results:** pass/fail for each item in 4.6, with measured contrast values.
5. **Per-screen scorecard:** each screen in section 3, scored 1–5 for clarity, speed and accessibility, with one line each.
6. **Per-role answer** (section 5).
7. **Design ideas:** at most 8, ranked. Include two bold ones, not just fixes. Describe each in a sentence or a rough sketch.
8. **Not checked:** what you could not test, and why.

Attach or link screenshots for every Critical and High finding. Keep the report under about 3,000 words. Lead with the worst problems. Don't pad.
