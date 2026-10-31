# Demo accounts

Created by `npm run setup` / `npm run db:reset` for **development and demos only**.
All accounts share one password: `Zimmed-Demo-2026!` (override with `SEED_PASSWORD` before seeding).

| Access level | Username | Name | Lands on / can do |
|---|---|---|---|
| **Practice manager** (`admin`) | `manager` | Rutendo Mapfumo | Billing, cash-up (all cashiers), claims, reports, stock, users, settings, audit log. **No** clinical notes. |
| **Doctor** (`doctor`) | `dr.moyo` | Tendai Moyo | Consultations, prescriptions, labs, referrals, patient history |
| **Doctor** | `dr.ncube` | Sipho Ncube | Same as above |
| **Doctor** | `dr.chikore` | Farai Chikore | Same as above |
| **Nurse** (`nurse`) | `sr.dube` | Sibusisiwe Dube | Triage, procedures, lab results entry, stock |
| **Nurse** | `sr.mutasa` | Precious Mutasa | Same as above |
| **Reception** (`reception`) | `reception` | Tatenda Banda | Patients, appointments, check-in, billing, cash-up (own), claims |

Doctors have fake registration numbers (`MDPCZ/A1234`, `A2345`, `A3456`) so prescriptions can be printed.

## Things to know

- **Two-factor** is switched off in the generated `.env.local` (`ENFORCE_2FA=false`) so the demo is easy to explore. It is required for the manager and doctors when that setting is removed. Turn it on to see the real enrolment flow.
- **Lockout:** 5 wrong passwords for one username locks it for 15 minutes, and 10 sign-ins from one address in 15 minutes is throttled. Restarting the dev server clears both.
- **Production:** the seed skips these accounts when `NODE_ENV=production`. Never reuse this password on a real server. Change it (Account → Change password) or create real staff in Administration.
- **Reset:** `npm run db:reset` wipes the dev database and recreates everything above.
