# DementiaSupport

Offline-first caregiver + family + patient cognitive engagement.

## Final stack (locked)

| Layer | Tech |
|-------|------|
| Mobile | Flutter (patient + caregiver) |
| Mobile DB | **Drift → SQLite** (offline truth) |
| Voice | Sherpa ONNX on-device (`VoiceEngine`) |
| Web SaaS | Next.js on Vercel |
| Backend | Supabase (Auth, Postgres, Storage, Realtime) |
| Cloud brain | Google Gemini — cold path only |

```bash
# Agent-oriented (after secrets in env)
# Flutter APK · supabase db push · vercel --prod
```

See `app/src/architecture.ts`. Capacitor `app/` is legacy reference during Flutter migration.

Fresh APK install = **real onboarding** (no demo seed):
1. Disclaimer  
2. Caregiver account + PIN  
3. Patient profile + session times  
4. Real family photo library (min 3)  
5. Daily sessions in PIN-locked patient mode  
6. Family hub at `/family` for relatives  

```bash
cd app
npm install
npm run dev
npm run build && npx cap sync android && npx cap open android
```

See [`app/README.md`](app/README.md) and `app/src/architecture.ts`.

**Disclaimer:** Not a medical device.
