/**
 * FINAL PRODUCTION STACK — DementiaSupport (locked)
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ MOBILE (patient + caregiver on device)                      │
 * │   Flutter + Dart                                            │
 * │   Local DB: Drift → SQLite   ← source of truth offline      │
 * │   Voice: VoiceEngine → Sherpa ONNX (hot path)               │
 * │   Sync outbox → Supabase when online                        │
 * ├─────────────────────────────────────────────────────────────┤
 * │ WEB SaaS (caregiver / family dashboard)                     │
 * │   Next.js (App Router) + TypeScript                         │
 * │   Host: Vercel                                              │
 * ├─────────────────────────────────────────────────────────────┤
 * │ BACKEND                                                     │
 * │   Supabase: Auth, Postgres+RLS, Storage, Realtime           │
 * ├─────────────────────────────────────────────────────────────┤
 * │ CLOUD BRAIN (cold path only — never blocks a session)       │
 * │   Google Gemini / Cloud APIs when online                    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Voice hot path: mic → VAD → streaming STT → score → TTS (on device).
 * Vercel / Supabase / Google are NOT in the live voice loop.
 *
 * Agent build: secrets via env / CLI (`supabase`, `vercel`) — never commit.
 * UI edits: Flutter `lib/theme` + widgets; web `app/` + CSS modules.
 */

export const FINAL_STACK = {
  mobile: 'flutter',
  mobileDb: 'drift-sqlite',
  mobileDbRole: 'offline-source-of-truth',
  voiceHotPath: 'sherpa-onnx',
  voiceInterface: 'VoiceEngine',
  web: 'nextjs-typescript',
  webHost: 'vercel',
  backend: 'supabase',
  backendServices: ['auth', 'postgres-rls', 'storage', 'realtime'] as const,
  cloudColdPath: 'google-gemini',
  sync: 'outbox-to-supabase',
} as const;

/** @deprecated use FINAL_STACK — kept so old imports don't break during migration */
export const PRODUCTION_HYBRID = FINAL_STACK;
export const HYBRID = FINAL_STACK;

export type Persona = 'caregiver' | 'family' | 'patient';

export const PERSONA_NAV = {
  caregiver: [
    { to: '/', label: 'Home', id: 'home' },
    { to: '/family', label: 'Family', id: 'family' },
    { to: '/progress', label: 'Progress', id: 'progress' },
    { to: '/settings', label: 'Settings', id: 'settings' },
  ],
  family: [
    { to: '/family', label: 'Home', id: 'family-home' },
    { to: '/progress', label: 'Progress', id: 'progress' },
    { to: '/settings', label: 'Back', id: 'settings' },
  ],
  patient: [] as { to: string; label: string; id: string }[],
} as const;
