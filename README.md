# MindCare — Local Demo Setup

Offline-first cognitive care for dementia patients + caregivers.

**Stack:** Express + vanilla PWA (web prototype) + Flutter + Sherpa ONNX (offline patient voice).

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
# Optional cloud STT when online:
# SPEECH_PROVIDER=gemini
# GEMINI_API_KEY=...
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

## Offline voice (Sherpa ONNX)

Web PWA uses Web Speech + cloud STT + chips. **Full offline STT** is the Flutter app:

```cmd
cd apps\flutter
flutter create . --project-name mindcare_flutter
powershell -ExecutionPolicy Bypass -File ..\..\scripts\download_sherpa_models.ps1
flutter pub get
flutter run
```

See `docs/VOICE_OFFLINE.md` and `apps/flutter/README.md`.

## Key folders

| Path | Purpose |
|------|---------|
| `server/` | Express API, Assam curriculum packs, NER geo resolver, cloud STT proxy |
| `public/` | PWA UI, voice layer, session player |
| `apps/flutter/` | Patient app + Sherpa ONNX `VoiceEngine` |
| `docs/VOICE_OFFLINE.md` | Offline / online voice ladder |
| `docs/DEFERRED_GAMES.md` | What’s shipped vs later |

## Deploy on Railway (shareable phone link)

1. Push this repo to GitHub (Railway deploys from GitHub, not your laptop).
2. Railway → New Project → **Deploy from GitHub** → select this repo.
3. Add a **PostgreSQL** plugin to the same project (Variables should get `DATABASE_URL` automatically).
4. In the **web service** Variables, also set:

```
JWT_SECRET=<long-random-string>
DEMO_MODE=true
DEMO_PHONE=+910000000000
```

5. Settings → Networking → **Generate Domain**.
6. Open that `https://….up.railway.app` URL on a phone. No `npm` on the phone.

If the deploy **crashes every few seconds**, open Deployments → View Logs. Common fixes:
- Missing/broken `DATABASE_URL` → add Postgres and redeploy
- Healthcheck failing → ensure latest code has `/health` and listens on `0.0.0.0` (this repo does)

## Troubleshooting

**Port 3000 in use:** change `PORT` in `.env`, or stop the other Node process.

**OTP:** with `DEMO_MODE=true`, any 6-digit code works.
