# ZimMedPractice

An EHR and practice-management system for a Zimbabwean private practice: patients,
the waiting-room queue, SOAP consultations with ICD-10, e-prescriptions, labs,
multi-currency (USD/ZiG) billing, medical aid claims, WhatsApp/SMS reminders and
offline-first operation.

Built with Next.js 16, PostgreSQL (PGlite for dev), Drizzle, Better Auth and Serwist.
It uses only open-source software and free tiers. See [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md).

## Documentation

- [Implementation plan](docs/PLAN.md): phases, definitions of done, decision log
- [Features and acceptance criteria](docs/FEATURES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security and compliance](docs/SECURITY.md)
- [Third-party services](docs/THIRD_PARTY.md)

## Quick start (development)

Requires Node.js 20.9+. No database install is needed, because PGlite runs Postgres
in-process.

```bash
npm install
npm run setup      # generates .env.local secrets, runs migrations, seeds demo data
npm run dev        # http://localhost:3000
```

Demo accounts for every access level are in [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md) and printed by `npm run setup`.

| Level | Username | Password |
|---|---|---|
| Practice manager | `manager` | `Zimmed-Demo-2026!` |
| Doctor | `dr.moyo` · `dr.ncube` · `dr.chikore` | same |
| Nurse | `sr.dube` · `sr.mutasa` | same |
| Reception | `reception` | same |

Development only: these accounts are not created when `NODE_ENV=production`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run setup` | Create secrets, migrate, seed |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run seed` | Re-seed reference and demo data |
| `npm test` | Unit and integration tests (Vitest, PGlite) |
| `npm run e2e` | Browser tests on their own server and database (port 3100, `.data/e2e`), safe to run while `npm run dev` is up. Sign-in sessions per role are in `e2e/roles.ts`. |
| `npm run e2e:ui` | Same, in Playwright's interactive viewer |
| `npm run db:reset` | Wipe the dev database and reseed the demo staff and patients |
| `npm run build` / `start` | Production build and run |

Production deployment (on-premise server, Caddy, Cloudflare Tunnel, backups) is
documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), which is written in Phase 8.
# ZimSurgery
