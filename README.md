# Pro Firmo — Legal & Tax Marketplace Platform

Pro Firmo is a directory + consultation platform that matches clients with
verified legal and tax professionals — advocates, chartered accountants, tax
consultants, and full-service firms — across India. The platform handles
discovery, identity verification, booking, payments, case management, and
end-to-end client / professional workflows.

> Status: production. Deployed to `https://profirmo.com` (frontend, Vercel) and
> `https://profirmo.onrender.com` (backend, Render). Storage on AWS S3
> (`profirmomain` bucket).

---

## Architecture

Three independent apps in one monorepo:

| App | Stack | Purpose |
| - | - | - |
| **`frontend/`** | Next.js 15 (App Router) · React 19 · Tailwind · `next/font` | Public marketing site + role-based dashboards (client / professional / firm admin / platform admin) |
| **`backend/`** | Node 20 · Express · Sequelize · MySQL (AWS RDS) | REST API, authentication, business logic, integrations |
| **`apps/`** | Expo · React Native | Mobile app for clients + professionals (iOS / Android) |

External services in production:

- **MySQL** — AWS RDS (`demo_project_db` on the `ap-south-1` Mumbai region)
- **Object storage** — AWS S3 bucket `profirmomain` (profile photos, KYC docs, case files, blog images, invoices)
- **Payments** — Razorpay (test + live credentials with admin-controlled mode toggle)
- **SMS OTP** — Ping4SMS
- **Email** — SMTP via `nodemailer` (configurable per environment)
- **E-Courts India** — `webapi.ecourtsindia.com` partner proxy for case search + order downloads + AI summaries
- **Attestr** — Unified eCourt case-details API

---

## Feature surface

**Public marketplace**
- Home with AI-powered hero, search box, featured directory, testimonials, Facebook page embed
- `/professionals` directory with filters (search, city, sub-category, rating, fee range, experience, availability)
- `/firms` directory
- `/professionals/city/<slug>` SEO landing pages — every Indian city with `<title>`, description, keywords, OpenGraph + canonical URL
- `/professionals/<id>/<slug>` profile page — about, skills tree (sub-cat → sub-sub-cat → tags), reviews with avatars
- `/blog`, `/blog/<slug>` — admin-managed blog with categories + tags
- `/ecourts` — case search by CNR / advocate / litigant; order PDF download + AI summary
- `/sitemap` (human-readable) + `/sitemap.xml` (dynamic, auto-includes new pros / posts / cities)
- `/contact` — support form (saves to admin "Pipeline → Support" + emails the support inbox)
- `/login`, `/signup` with phone-OTP + email/password
- Footer newsletter signup with optional follow-up profile modal

**Roles + dashboards**
- Client — bookings, cases, consultation history, reviews, payments
- Professional — clients, cases (notes, updates, file attachments via S3), availability, rate, subscription, payouts, reviews
- Firm admin — firm profile, team, collective cases / reviews / payments
- Platform admin — every module via `/admin/*`

**Admin panel (`/admin/*`)**
- Users (bulk suspend / activate / mark featured / verify email / delete)
- Professional approvals + featured curation
- Law firms (CRUD, bulk featured / status / delete)
- Categories (3-tier taxonomy editor for Legal + Tax, drag-style nesting)
- Locations (countries / states / cities)
- Reviews + appeals
- Pipeline (leads, opportunities, support tickets, newsletter subscribers)
- Content (blog posts, categories, tags)
- Finance (payments, payouts, subscriptions)
- Audit logs + platform settings (Razorpay, SMS, eCourts, Attestr, S3, support inbox, etc.)

**Cross-cutting**
- Bilingual EN / HI (every public-facing string)
- Identity verification + KYC document review workflow
- Per-minute consultation billing with platform-fee markup
- Case file attachments stored under `case-files/<caseId>/` in S3, served via auth-gated streaming (every byte re-verifies caller's case access)
- Image uploads auto-compressed: profile pics ≤200 KB, case-note images ≤300 KB; PDFs untouched
- AES-256-GCM at-rest encryption for admin-stored secrets (AWS secret key, Razorpay key, etc.)
- Bar Council India compliance — directory-style listings, no "top / best / hand-picked" advocate promotion language

---

## Folder structure

```
profirmo/
├── frontend/                 # Next.js 15 App Router
│   ├── app/
│   │   ├── (public pages)/   # /, /professionals, /firms, /blog, /ecourts, /contact, /sitemap, …
│   │   ├── admin/            # /admin/users, /admin/professionals, /admin/categories, …
│   │   ├── dashboard/        # role-scoped: /dashboard/client, /dashboard/professional, …
│   │   ├── api/              # (none — backend is separate)
│   │   ├── sitemap.js        # dynamic /sitemap.xml
│   │   ├── robots.js         # dynamic /robots.txt
│   │   └── layout.js
│   ├── components/           # common/, home/, professionals/, cases/, dashboard/, …
│   ├── services/             # API client wrappers (one per resource)
│   ├── hooks/                # useAuth, useProfessionals, useLocations, …
│   ├── data/                 # translations.js, translations.dashboard.js, …
│   ├── public/images/        # static assets (logo etc.)
│   └── tailwind.config.js
│
├── backend/                  # Node + Express + Sequelize
│   ├── src/
│   │   ├── config/           # env, database, cors
│   │   ├── controllers/      # HTTP layer
│   │   ├── routes/           # one router per resource
│   │   ├── services/         # business logic (caseService, paymentsService, storageService, …)
│   │   ├── models/           # Sequelize models
│   │   ├── middleware/       # auth, role, error handling, upload (multer memory)
│   │   ├── utils/            # responseHandler, tokenHelper, validators, secretCrypto, imageCompressor
│   │   ├── data/             # additive migrations + seed scripts (migrate.js, legal/tax taxonomy seeds, …)
│   │   ├── scripts/          # ad-hoc admin scripts (migrateUploadsToS3, seedBlog, …)
│   │   ├── app.js
│   │   └── server.js
│   ├── uploads/              # local-driver fallback (S3 is the production target)
│   └── package.json
│
├── apps/                     # Expo React Native (iOS / Android)
│   ├── src/
│   │   ├── screens/          # guest, client, professional, shared
│   │   ├── services/         # mirrors backend client surface
│   │   ├── components/
│   │   ├── config/api.js
│   │   └── utils/imageUrl.js
│   └── package.json
│
├── README.md
└── .gitignore
```

---

## Prerequisites

- Node.js 20+ (Next.js 15 + AWS SDK v3 prefer 18.18+; pinned to 20 in production)
- npm 10+
- MySQL 8.x (or AWS RDS access)
- (Optional, for mobile) Expo Go on a phone OR an iOS/Android simulator

---

## Environment setup

### Backend — `backend/.env`

```
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

JWT_SECRET=replace-with-secure-secret           # also derives the at-rest encryption key
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_DAYS=365

DB_HOST=<rds-or-localhost>
DB_PORT=3306
DB_NAME=demo_project_db
DB_USER=<user>
DB_PASSWORD=<password>
DB_SSL=true                                     # required for AWS RDS

MAX_UPLOAD_BYTES=10485760                       # 10 MB
```

All third-party API keys (Razorpay, S3, eCourts, Attestr, Ping4SMS, SMTP) are
admin-managed via `/admin/settings` and stored encrypted in the
`admin_settings` table. Env-var defaults are honoured as a fallback.

### Frontend — `frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Production builds on Vercel also set `API_BACKEND_URL` so server-side fetches
(SEO landing pages, sitemap) hit the backend directly. The frontend has
hardcoded production fallbacks for `https://profirmo.onrender.com` (API) and
`https://profirmomain.s3.ap-south-1.amazonaws.com` (S3) so a misconfigured env
on a fresh deploy still renders correctly.

### Mobile — `apps/src/config/api.js`

Defaults to `http://localhost:5001`. Override with `EXPO_PUBLIC_API_URL`.

---

## Local development

Three terminals:

```bash
# Terminal 1 — backend (port 5001)
cd backend && npm install && npm run dev

# Terminal 2 — frontend (port 3000)
cd frontend && npm install && npm run dev

# Terminal 3 — mobile (Metro on port 8081)
cd apps && npm install && npm start
```

On first boot the backend runs additive schema migrations and seeds the
Legal + Tax taxonomies (1216 + 712 rows), Indian states (37), cities (882
de-duplicated), case statuses (70), case types (136), and demo users — all
idempotent so subsequent boots are fast.

### Local URLs

| Surface | URL |
| - | - |
| Frontend | http://localhost:3000 |
| Backend | http://localhost:5001 |
| Backend health | http://localhost:5001/api/health |
| Mobile (Expo Go) | `exp://<LAN-ip>:8081` |
| XML sitemap | http://localhost:3000/sitemap.xml |
| robots.txt | http://localhost:3000/robots.txt |

### Demo accounts

All seeded with password **`password123`**:

| Email | Role |
| - | - |
| `client@demo.com` | Client |
| `pro@demo.com` | Individual professional |
| `firmadmin@demo.com` | Firm admin |
| `firmpro@demo.com` | Firm professional |
| `admin@demo.com` | Platform admin |

---

## Deployment

| Layer | Host | Notes |
| - | - | - |
| Frontend | Vercel | Auto-deploys `main`. Required envs: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `API_BACKEND_URL` |
| Backend | Render | Auto-deploys `main`. Required envs: `JWT_SECRET`, `DB_*`. Free tier cold-starts ~30s; the seed function is drift-safe (it never wipes if any row exists). |
| Database | AWS RDS MySQL | Same instance for dev + prod (different schemas). SSL required. |
| Object storage | AWS S3 | Bucket `profirmomain` in `ap-south-1`. Public prefixes (`profile-images/`, `company-logos/`, `banners/`, `blog-images/`, `category-icons/`, `users/`) need a public-read bucket policy; private prefixes (`case-files/`, `documents/`, `invoices/`, `temp/`) served via presigned URLs. |
| Mobile | Expo / EAS | Run `eas build` for app-store binaries. |

### Storage prefix map

```
profirmomain/
├── profile-images/      # public  — profile + cover photos, firm logos
├── company-logos/       # public
├── banners/             # public
├── blog-images/         # public
├── category-icons/      # public
├── users/               # public  — generic user-owned files
├── case-files/<caseId>/ # private — auth-gated streaming, per-case folder
├── documents/           # private — KYC docs (resume, license, certifications)
├── invoices/            # private
└── temp/                # private — connectivity test target
```

---

## API surface (summary)

All responses use a JSON envelope: `{ success, message, data, meta? }`.
Authenticated routes require `Authorization: Bearer <jwt>`.

| Group | Notable endpoints |
| - | - |
| Auth | `POST /api/auth/login`, `register-client`, `register-professional`, `register-firm`, `GET /api/auth/me`, `POST /api/auth/phone/{send-otp,verify-otp}`, `GET /api/auth/razorpay-config` |
| Professionals | `GET /api/professionals`, `GET /:id`, `GET /:id/reviews`, `GET /:id/availability`, `PATCH /:id/availability`, `PATCH /:id/rate` |
| Firms | `GET /api/firms`, `GET /:id`, `GET /:id/professionals`, `GET /:id/clients`, `GET /:id/cases` |
| Cases | `GET / POST / PATCH / DELETE /api/cases`, notes + updates, `GET /:id/attachments/url`, `GET /:id/attachments/stream` |
| Bookings | `POST /api/bookings`, `PATCH /:id/status`, `GET /client/:id`, `GET /professional/:id` |
| Consultations | start / end / notes / recording / transcript per consultation id |
| Reviews | `POST /api/reviews`, `GET /professional/:id`, `GET /firm/:id`, appeals |
| Files | `POST /api/files/upload` (memory → S3 / local), `GET /api/files`, `DELETE /:id` — returns absolute URLs |
| Payments | Razorpay Checkout creation + webhook verification + payouts |
| E-Courts | search, case detail, order PDF, AI summary, refresh-as-add, favourites, import-as-case |
| Newsletter | `POST /api/newsletter/subscribe`, `PATCH /complete` (public) |
| Support | `POST /api/support/contact` (public, emails the admin support inbox) |
| App settings | `GET /api/app-settings/{categories,cities,locations,storage,...}` — public read-only |
| Admin | `/api/admin/*` — every module above + audit logs + platform settings + storage test |

Detailed schemas live alongside each route + service file.

---

## Operational notes

- **Sub-category taxonomy** — Legal is 34 tier-1 / 105 tier-2 / 1077 tier-3 entries; Tax is 24 / 78 / 610. Each tagged sub-category on a professional expands into the full descendant tree on their profile page's "Skills & specialisations" block.
- **City coverage** — 882 de-duplicated Indian cities. Footer surfaces 30 metro + state-capital landing pages; sitemap surfaces every city.
- **Image compression** runs server-side on upload using `sharp` — profile + logo categories target 200 KB, case-note images target 300 KB, everything else stored as-is. PDFs always untouched.
- **Bar Council compliance** — no "Top / Best / Hand-picked" language. The home directory section is admin-curated via the `featured` flag on sub-categories.
- **Encryption** — `aws_secret_access_key` and other sensitive admin settings stored as `enc:v1:<base64>` AES-256-GCM ciphertext; decryption key derived from `JWT_SECRET`.
- **Case-file privacy** — every byte fetch goes through `GET /api/cases/:id/attachments/stream`, which re-verifies the caller can access the case before proxying the bytes. A leaked URL is useless without an auth-bearing request.

---

## Troubleshooting

- **Backend won't start** — check `DB_*` env vars (RDS expects `DB_SSL=true`). On macOS, port 5001 may be claimed by an old node; `pkill -f "node src/server.js"`.
- **Frontend can't reach backend** — ensure `NEXT_PUBLIC_API_URL` matches the backend port and restart the dev server (NEXT_PUBLIC_* is read at build/dev-server start).
- **Razorpay 401 / wrong key** — verify the **Razorpay Mode** dropdown in `/admin/settings`; the active keyId is exposed at `/api/auth/razorpay-config`.
- **S3 403** — public prefixes need a public-read bucket policy. Private prefixes return presigned URLs that expire after 15 min by default.
- **Seed table drift** — taxonomy seeds skip when any rows already exist under their parent category. To force a clean reseed: `DELETE FROM sub_categories WHERE categoryId=<id>` then restart the backend.
- **Vercel city page 404** — make sure `API_BACKEND_URL` is set in Vercel project env so SSR fetches hit Render, not localhost.
- **Mobile build fails** — bump Node to 20 (`nvm use 20`) and clear Metro cache (`npm start -- --reset-cache`).

---

## License

Proprietary — © Pro Firmo. All rights reserved.
