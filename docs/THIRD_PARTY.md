# ZimMedPractice — Third-party Services and Libraries

Policy: open-source libraries are preferred over services. Services are used only on
free tiers, and the app must keep working (degraded) if any service is unavailable.
Free-tier terms change, so re-check each provider's pricing page before go-live.

## Hosted services

| Service | Used for | Free tier / cost | Caveats | If unavailable |
|---|---|---|---|---|
| **Cloudflare Tunnel** (+ optional Access) | Remote HTTPS access without opening ports | Free | Needs a domain on Cloudflare DNS | LAN access still works |
| **Cloudflare DNS** | DNS-01 challenge for Caddy's Let's Encrypt certificates | Free | — | The certificate stays valid ~90 days and renews when online |
| **Let's Encrypt** (via Caddy) | TLS certificates | Free | — | — |
| **Cloudflare R2** | Offsite encrypted backups | Free tier is ~10 GB storage with no egress fees | Backups are `age`-encrypted before upload. Offshore storage (see SECURITY §7). | Backups queue locally |
| **Meta WhatsApp Cloud API** (direct, no BSP) | Reminders, recalls, results-ready notices | No platform fee. **Business-initiated template messages (utility) are charged per delivered message** by Meta. Patient-initiated service replies are free. Meta changes these rules periodically (a change around Oct 2026 is reported by third parties). | Needs Meta Business verification and approved templates | Falls back to SMS, then click-to-chat |
| **WhatsApp click-to-chat** (`wa.me` links) | Manual sending from the practice phone | Free | Manual: reception taps "Send" | — |
| **SMS Gateway for Android** (capcom6, Apache-2.0) | SMS through a practice Android phone + SIM | App is free and open source. Pay only the SIM's bundle/airtime. | Phone must stay powered and online. Cloud relay mode uses `api.sms-gate.app`, while local mode stays on the LAN. | Click-to-chat / call |
| **SMTP** (Brevo free tier, or the practice's own mailbox) | Emailing claim batches to medical aids | Brevo free is roughly 300 emails/day | Claim files contain PHI. Send only to the society's official claims address, and prefer password-protected archives if the aid supports them. | Download the CSV and send manually |
| **GitHub** + Actions | Source hosting and CI | Free for private repos within minute limits | Never store real patient data or secrets in the repo | — |

### Considered and rejected for production

| Service | Reason |
|---|---|
| Vercel Hobby | Restricted to non-commercial personal use. A medical practice is commercial. |
| Supabase Free | Projects pause after about 7 days of inactivity, there are no backups, and data is hosted offshore. Acceptable only for a demo instance. |
| Hosted auth (Clerk, Auth0) | PHI-adjacent identity data offshore, no LAN-only operation, and limits on free tiers |
| Sentry SaaS | Risk of PHI in error payloads. We use local structured logs instead. |
| Paid SMS aggregators | Not free. Can be added later as another provider. |
| Exchange-rate APIs | No reliable free source for the official ZiG rate. Entered manually from RBZ. |

## Open-source libraries (runtime)

| Library | Licence | Purpose |
|---|---|---|
| next, react, react-dom | MIT | Framework |
| better-auth | MIT | Authentication, sessions, 2FA |
| drizzle-orm, drizzle-kit | Apache-2.0 | ORM and migrations |
| postgres (postgres.js) | Unlicense | Production PostgreSQL driver |
| @electric-sql/pglite | Apache-2.0 / PostgreSQL | Embedded Postgres for dev and tests |
| zod | MIT | Validation |
| serwist, @serwist/turbopack | MIT | Service worker / PWA |
| dexie | Apache-2.0 | IndexedDB cache and outbox |
| tailwindcss | MIT | Styling |
| recharts | MIT | Charts |
| nodemailer | MIT-0 | SMTP email |
| lucide-react | ISC | Icons |
| dexie-react-hooks | Apache-2.0 | Live queries for the offline outbox |
| qrcode | MIT | Renders the 2FA enrolment QR locally |

## Reference data

| Data | Source | Notes |
|---|---|---|
| ICD-10 | WHO ICD-10 (curated primary-care subset bundled) | Check WHO licensing terms before importing the full classification. A full import is supported via a CSV loader. |
| Medicines formulary | Hand-curated list of generics commonly stocked in Zimbabwe | Not a substitute for MCAZ registration status. The practice should review it. |
| Tariff codes | Placeholder values in the AHFoZ style | **Must** be replaced with the practice's current AHFoZ/aid tariff schedule |
| Labs | Lancet Laboratories, PathCare Zimbabwe, National Pathology Research Services | Editable in settings |
