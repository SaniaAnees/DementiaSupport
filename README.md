# MindCare — Local Demo Setup

Offline-first cognitive care for dementia patients + caregivers.

**Stack:** Express + vanilla PWA (SQLite fallback when Postgres is unavailable).

The older Vite/Capacitor demo lives on branch `vite-app` if you need it.

---

## Step 1: Install dependencies

```cmd
cd C:\Users\SANIA ANEES\OneDrive\Desktop\MindCare
npm install
```

## Step 2: Create the .env file

Copy `.env.example` to `.env`, or create `.env` with:

```
DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/mindcare
JWT_SECRET=dev-secret-for-local-use-only-1234567890
DEMO_MODE=true
DEMO_PHONE=+910000000000
PORT=3000
```

If PostgreSQL is not running, the server automatically falls back to local SQLite in `data/`.

## Step 3: Start the server

```cmd
npm start
```

Open **http://localhost:3000**

## Step 4: Demo flow

1. Enter phone `+910000000000` (any 6-digit OTP in demo mode)
2. Set a 4-digit PIN
3. Complete caregiver onboarding (patient, language, hometown, family photos)
4. Switch to **Patient** mode → Morning / Evening session

## Key folders

| Path | Purpose |
|------|---------|
| `server/` | Express API, Assam curriculum packs, NER geo resolver |
| `public/` | PWA UI, voice layer, session player |
| `docs/DEFERRED_GAMES.md` | What’s shipped vs later |

## Troubleshooting

**Port 3000 in use:** change `PORT` in `.env`, or stop the other Node process.

**OTP:** with `DEMO_MODE=true`, any 6-digit code works.
