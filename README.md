# Profirmo — Online Professional Consultation & Case Management Platform

Profirmo is a full-stack SaaS platform that connects clients with verified
professionals — advocates, lawyers, legal firms, tax consultants and advisory
firms — for online per-minute consultations, secure bookings and end-to-end
client/case management.

The project is split into two independent applications:

- **`frontend/`** — a Next.js (App Router, JavaScript) SaaS web application.
- **`backend/`** — a Node.js + Express.js REST API.

> Current status: working starter built on **mock / in-memory data**. The
> backend is structured so it can later be connected to MongoDB or PostgreSQL
> without rewriting the API surface.

---

## Features

1. Public marketing website (home, about, how it works, pricing, contact)
2. Professional listing with rich search & filters
3. Professional profile pages (services, availability, reviews)
4. Firm listing and firm profile pages (team members, services)
5. Client registration & login
6. Professional registration & login
7. Firm registration & login
8. Role-based dashboards (client, professional, firm admin, platform admin)
9. Consultation booking (instant & scheduled)
10. Real-time availability status & per-minute pricing
11. Scheduled consultation slots
12. Client & case management
13. File / document management (placeholder)
14. Consultation history
15. Consultation room with call / recording / transcript placeholders
16. Ratings & reviews
17. CMS pages (terms, privacy, etc.)
18. Contact form
19. JWT authentication & role-based access control structure
20. Reports & analytics placeholders

---

## User roles

| Role | Description |
| --- | --- |
| Public visitor | Browses the site, searches professionals & firms |
| Client / user | Books consultations, manages cases, documents & history |
| Individual professional | Manages own clients, cases, files, availability & rate |
| Firm admin | Manages the firm, its professionals, and sees all firm data |
| Firm professional / staff | A lawyer/consultant under a firm with their own login |
| Platform admin | Oversees users, professionals, firms, approvals & reports |

A firm can register one organisation account, add multiple professionals (each
with a separate login), and the firm admin sees all professionals, clients,
cases, files and consultation records collectively.

---

## Folder structure

```
profirmo/
│
├── frontend/                 # Next.js application (App Router, JavaScript)
│   ├── app/                  # Routes: home, CMS, auth, dashboards, booking…
│   ├── components/           # common / home / professionals / firms /
│   │                         #   booking / dashboard / consultation
│   ├── services/             # API service layer (auth, professionals, …)
│   ├── hooks/                # useAuth, useProfessionals, useFirms, …
│   ├── utils/                # constants, formatters, validators
│   ├── data/mockData.js      # Frontend mock dataset (offline fallback)
│   ├── public/
│   ├── .env.local.example
│   ├── package.json
│   ├── next.config.js
│   ├── postcss.config.js
│   └── tailwind.config.js
│
├── backend/                  # Node.js + Express.js REST API
│   ├── src/
│   │   ├── config/           # env.js
│   │   ├── controllers/      # auth, professional, firm, client, case, …
│   │   ├── routes/           # one router per resource
│   │   ├── services/         # business logic over the mock data
│   │   ├── middleware/       # auth, role, error handling, validation
│   │   ├── models/           # record builders + future DB schema notes
│   │   ├── data/mockData.js  # In-memory dataset
│   │   ├── utils/            # responseHandler, tokenHelper, validators
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
├── README.md
└── .gitignore
```

---

## Prerequisites

- Node.js 18.18 or later
- npm

---

## Environment variable setup

### Backend — `backend/.env`

Copy the example file and adjust if needed:

```bash
cd backend
cp .env.example .env
```

```
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=replace_with_secure_secret
```

### Frontend — `frontend/.env.local`

```bash
cd frontend
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Backend setup & run

```bash
cd backend
npm install
npm run dev
```

- `npm run dev` — start with nodemon (auto-reload)
- `npm start` — start without nodemon

The backend runs on **http://localhost:5000**.

## Frontend setup & run

Run this in a **separate terminal** from the backend.

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on **http://localhost:3000**.

The frontend works even if the backend is offline — service hooks fall back to
the bundled mock data — but run both for the full experience.

---

## Local development URLs

| Application        | URL                                |
| ------------------ | ---------------------------------- |
| Frontend           | http://localhost:3000              |
| Backend            | http://localhost:5000              |
| Backend health API | http://localhost:5000/api/health   |

### Demo accounts

All demo accounts use the password **`password123`**:

| Email | Role |
| --- | --- |
| `client@demo.com` | Client |
| `pro@demo.com` | Individual professional |
| `firmadmin@demo.com` | Firm admin |
| `firmpro@demo.com` | Firm professional |
| `admin@demo.com` | Platform admin |

---

## API endpoint summary

All responses use a consistent JSON envelope:
`{ success, message, data }` (list endpoints add `meta` pagination).

**Health**
- `GET /api/health`

**Auth**
- `POST /api/auth/login`
- `POST /api/auth/register-client`
- `POST /api/auth/register-professional`
- `POST /api/auth/register-firm`
- `GET /api/auth/me`

**Professionals**
- `GET /api/professionals`
- `GET /api/professionals/search`
- `GET /api/professionals/:id`
- `GET /api/professionals/:id/reviews`
- `GET /api/professionals/:id/availability`
- `PATCH /api/professionals/:id/availability`
- `PATCH /api/professionals/:id/rate`

**Firms**
- `GET /api/firms`
- `GET /api/firms/:id`
- `GET /api/firms/:id/professionals`
- `POST /api/firms/:id/professionals`
- `GET /api/firms/:id/clients`
- `GET /api/firms/:id/cases`

**Clients**
- `GET /api/clients`
- `GET /api/clients/:id`
- `POST /api/clients`
- `PATCH /api/clients/:id`

**Cases**
- `GET /api/cases`
- `GET /api/cases/:id`
- `POST /api/cases`
- `PATCH /api/cases/:id`
- `DELETE /api/cases/:id`
- `GET /api/cases/client/:clientId`
- `GET /api/cases/professional/:professionalId`

**Bookings**
- `GET /api/bookings`
- `GET /api/bookings/:id`
- `POST /api/bookings`
- `PATCH /api/bookings/:id/status`
- `GET /api/bookings/client/:clientId`
- `GET /api/bookings/professional/:professionalId`

**Consultations**
- `GET /api/consultations`
- `GET /api/consultations/:id`
- `POST /api/consultations/:id/start`
- `POST /api/consultations/:id/end`
- `GET /api/consultations/:id/recording`
- `GET /api/consultations/:id/transcript`
- `POST /api/consultations/:id/notes`

**Reviews**
- `GET /api/reviews`
- `POST /api/reviews`
- `GET /api/reviews/professional/:professionalId`
- `GET /api/reviews/firm/:firmId`

**Admin** (requires a `platform_admin` JWT)
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/professionals/pending`
- `PATCH /api/admin/professionals/:id/approve`
- `GET /api/admin/firms`
- `GET /api/admin/bookings`

Protected endpoints expect an `Authorization: Bearer <token>` header. Obtain a
token from `POST /api/auth/login`.

---

## Notes for future integration

The codebase is intentionally modular so the following can be added without
restructuring:

- **Database** — replace `src/data/mockData.js` and the service layer with a
  real datastore. Each file in `src/models/` documents the intended schema and
  is the natural place to introduce Mongoose or Sequelize/Prisma models.
- **Payment gateway** — the booking flow uses a `PaymentPlaceholder` component
  and bookings carry an `estimatedCost`. Integrate Razorpay / Stripe in the
  booking confirm step and add a payments service/route on the backend.
- **Video / audio calling** — the consultation room (`CallRoom`) is a UI
  placeholder. Integrate a WebRTC provider (Twilio, Agora, Daily, LiveKit) and
  drive call state from the `consultations` resource.
- **Call recording** — `RecordingStatus` and the consultation `recordingUrl`
  field are placeholders; wire them to the calling provider's recording API and
  object storage.
- **AI transcription** — `TranscriptPanel` and the consultation `transcript`
  field are placeholders; connect a speech-to-text service to populate them.
- **Notifications** — add email / SMS / push notifications (e.g. for booking
  confirmations and reminders) via a notification service and provider.
- **Reports & analytics** — admin and firm dashboards include analytics
  placeholders ready to be backed by real aggregation queries.

---

## Troubleshooting

- **Frontend cannot reach the backend** — ensure the backend is running on port
  5000 and `NEXT_PUBLIC_API_URL` in `frontend/.env.local` matches. Restart the
  frontend dev server after changing any `NEXT_PUBLIC_*` variable.
- **CORS errors** — confirm `FRONTEND_URL` in `backend/.env` is
  `http://localhost:3000`, then restart the backend.
- **Port 5000 already in use (macOS)** — macOS "AirPlay Receiver" listens on
  port 5000. Disable it in *System Settings → General → AirDrop & Handoff*, or
  set a different `PORT` in `backend/.env` and update `NEXT_PUBLIC_API_URL`
  accordingly.
- **Port 3000 already in use** — stop the other process or run
  `npm run dev -- -p <port>` for the frontend.
- **Environment variables not applied** — make sure you copied
  `.env.example` → `.env` (backend) and `.env.local.example` → `.env.local`
  (frontend), then restart the dev servers.
