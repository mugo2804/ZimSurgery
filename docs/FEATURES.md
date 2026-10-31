# ZimMedPractice — Functional Specification

Each module lists what it does, which roles use it, and its **acceptance criteria (AC)**.
The ACs are what Phase DoDs in [PLAN.md](PLAN.md) are tested against.

Roles: **ADM** practice manager/admin · **DR** doctor · **NU** nurse · **RC** reception.

---

## A. Patient registration and smart intake (RC, NU, DR, ADM)

**Data captured**
- Identity: first and last name, date of birth, sex, **Zimbabwe national ID**
  (format `NN-NNNNNN(N) X NN`, validated and normalised), file number (auto
  `ZMP-000001`).
- Contact: mobile, WhatsApp number (defaults to mobile), email, physical address and
  city (kept as proof of residence), occupation.
- Next of kin / emergency contact: name, relationship, phone.
- Medical aid: society, membership number, principal member name, **dependant code**
  (`00` principal, `01`, `02`…), last verified (date, by whom, method).
- Clinical alerts: allergies (substance, reaction, severity
  mild/moderate/severe/anaphylaxis) and chronic conditions (pick list plus free text).
- Communication: consent (yes/no), preferred channel (WhatsApp/SMS), and recall
  interval in months.

**AC**
- A1. Phone numbers are normalised to `2637XXXXXXXX`. Invalid numbers are rejected
  with a clear message.
- A2. A duplicate national ID or an identical name+DOB raises a "possible duplicate"
  warning with a link to the existing record.
- A3. The **alert banner** shows on every patient-context screen (file, triage,
  consultation, billing, prescription). Severe allergies are red, chronic conditions
  amber, and "No known allergies" grey. An unrecorded allergy status shows as "Allergies
  not recorded".
- A4. Every view of a patient file writes a `patient.view` audit entry.

## B. Front desk and queue (RC, NU, DR)

**Appointments:** a day view with a column per doctor and 15-minute slots. Booking
search finds or creates patients. Statuses are booked, confirmed, arrived, completed,
cancelled and DNA. Overlapping bookings for the same doctor show a warning.

**Check-in:** from an appointment or as a walk-in. You pick the doctor (or "next
available"), payer (cash/medical aid), priority (normal/urgent) and presenting
complaint.

**Waiting-room board:** columns *Checked in → Triage done → With nurse → With doctor →
Billing → Completed*. Cards show name, age, sex, payer, doctor, time in current status
(amber over 30 min, red over 60 min), urgent flag and an allergy icon. It updates live.

**AC**
- B1. Status changes appear on other open boards within 3 s (SSE), or 15 s with the
  polling fallback.
- B2. Each status change is time-stamped in `visit_status_log` (used for wait-time
  analytics).
- B3. Marking an appointment DNA is only possible after its start time.
- B4. Reception can move cards between non-clinical statuses. Only NU/DR can move a
  card to *With nurse* or *With doctor*.

## C. Clinical workstation (DR, NU)

**Triage (NU, DR):** BP systolic/diastolic, pulse, respiratory rate, temperature °C,
SpO₂, weight, height, auto BMI, random glucose, pain score 0–10, and notes.
- Out-of-range flags: BP ≥140/90 or <90/60; pulse >100 or <50; temp ≥37.5 or <35.5;
  SpO₂ <94; glucose >11.1 or <4.0 mmol/L.
- Saving moves the visit to *Triage done* and it appears in the doctor's view.

**Procedures/immunisations (NU, DR):** item, dose, route, site, batch number, given by,
and optional stock deduction.

**Consultation (DR) in SOAP format**
- **S**ubjective: complaint and history. **O**bjective: examination, with the latest
  vitals shown alongside. **A**ssessment: ICD-10 diagnoses (one primary, plus
  secondaries) and notes. **P**lan: treatment, prescriptions, lab orders, referrals,
  follow-up date.
- Drafts autosave every 10 s and on blur. **Sign** locks the note. Changes after
  signing are appended as addenda (author, time).
- The history sidebar shows previous diagnoses, current medicines, recent vitals trend
  and outstanding labs.

**E-prescription (DR)**
- Search the bundled formulary of medicines commonly stocked in Zimbabwe (generic name,
  strength, form, default dose/frequency).
- **Allergy check:** if a medicine matches a recorded allergy (substance or drug class,
  e.g. Penicillin → Amoxicillin), the doctor must type an override reason, which is
  audited.
- The printable A5 script shows practice letterhead, doctor name, qualification,
  **HPZ registration number**, patient details (name, age, address, medical aid), the
  Rx list, date, signature line and a **practice stamp box**. It also prints the Rx
  number for verification.

**Lab and imaging orders (DR):** lab (Lancet Laboratories, PathCare Zimbabwe, National
Pathology Research Services, other), tests (pick list of common panels and imaging),
clinical information, urgency. The printable requisition includes medical aid details.
Results can be captured as text (encrypted) by NU/DR. Status runs ordered → sample
taken → resulted.

**Referral letters (DR):** recipient, specialty, facility, urgency and a letter
pre-filled from the consultation (history, findings, diagnoses, medications). Printable.

**AC**
- C1. S/O/A/P text, lab results and referral letters are stored encrypted (`v1:` prefix
  in the DB).
- C2. RC and ADM receive 403 on every clinical read/write endpoint.
- C3. An allergy conflict cannot be saved without an override reason.
- C4. Printed scripts show the prescriber's HPZ number. Printing is blocked if the
  prescriber has none on their profile.

## D. Billing, medical aids and claims (RC, ADM; DR read)

**Tariffs:** code, description, category, cash price (USD) and default medical aid
price (USD), with optional per-society overrides. Seed codes are placeholders and must
be checked against the current AHFoZ tariff schedule.

**Exchange rate:** ZiG per 1 USD, effective timestamp and source (e.g. "RBZ interbank
2026-10-30"). The current rate is shown in the top bar. A warning appears if no rate
has been entered today.

**Invoice:** created per visit and priced in USD.
- **Cash patient:** total = sum of cash prices.
- **Medical aid patient:** for each line, the aid pays its tariff rate. The patient
  pays the **shortfall** (practice price − aid rate, minimum 0). Invoice shows the aid
  portion, patient portion and an ICD-10 code per line (required for aid invoices).

**POS:** tenders are USD cash, ZiG cash, Swipe (ZimSwitch), EcoCash, InnBucks and bank
transfer. Split tender is supported.
- A ZiG tender converts at the current rate. The rate is stored on the payment.
- Change is computed for cash tenders.
- The receipt shows each tender in its original currency and the USD equivalent.

**Cash-up:** pick a day and cashier to see totals per method × currency. Enter declared
cash counted (USD, ZiG) to see the variance. Printable and audited.

**Claims:** a pending list grouped by society. Select invoices to create a batch
(`CLM-000001`), then export CSV and/or email it to the society's claims address. Status
runs draft → submitted → paid/rejected. Remittance can be captured per invoice. Paid
amounts post as `medical_aid` payments.

**AC**
- D1. Money is stored in integer cents. Splits are exact, so aid + patient = total.
- D2. ZiG payments store the amount in ZiG cents and the rate. USD equivalent =
  round(ZiG / rate).
- D3. An invoice becomes `paid` when the patient portion is fully covered. Claim status
  is tracked separately.
- D4. Paid invoices cannot be edited. Voiding needs a reason and ADM permission.
- D5. The cash-up totals equal the sum of the payments for that day (Africa/Harare day
  boundaries).

## E. Patient engagement (system, RC)

- **Confirmation** when an appointment is booked.
- **Reminder** 24 h before (sent once, between 07:00 and 19:00 local time).
- **Chronic recall:** patients with a recall interval whose last visit is older than
  the interval and who have no future appointment. These show on a due list, with
  bulk send.
- **Results ready:** "Your results are ready, please contact the practice." It never
  includes the result itself.
- Channel: the patient's preference (WhatsApp → SMS fallback). If no automated
  provider is configured, the UI offers a **click-to-chat** `wa.me` link so reception
  can send from the practice phone.

**AC**
- E1. No message is sent to patients without comms consent.
- E2. Reminders are never sent twice for the same appointment.
- E3. Messages contain no diagnosis, result or medication names.

## F. Analytics and reporting (ADM)

- Footfall per day/month, new vs returning patients.
- Revenue by currency (USD/ZiG actually collected) and by method. Outstanding patient
  balances. Aid claims outstanding by society.
- Patients seen per doctor, average consultation and waiting times.
- Top 10 diagnoses (ICD-10) for the period.
- DNA rate.

**AC**
- F1. Reports only aggregate data. No clinical text is exposed to ADM.

## G. Stock and administration (ADM, NU)

- Stock items: batch, expiry, quantity, reorder level. Movements are receive, issue,
  adjust and expire, each with a reason. Low-stock and expiring-in-60-days alerts.
- Users: create, edit, disable, reset password, reset 2FA. Profile includes HPZ number
  and qualification for doctors.
- Settings: practice name, address, phone, email, AHFoZ practice number, letterhead
  text.
- Audit log viewer: filters by user, patient, action and date, plus **Verify chain**.

**AC**
- G1. Only ADM can manage users and settings. Every admin action is audited.
- G2. Chain verification reports the first broken sequence number if any row was
  altered outside the app.
