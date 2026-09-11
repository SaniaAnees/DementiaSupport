# DementiaSupport — Master Build Prompt (Production / Hackathon)

> **How to use:** Paste this entire document into a Cursor Agent session (or feed it phase-by-phase via `PHASED_EXECUTION.md`). The agent must implement a complete, shippable Android APK. Do not ask the user to fill gaps that this prompt already decides. Prefer working software over perfect architecture.

---

## 0. Mission

Build **DementiaSupport**: an AI-powered, personalized, **offline-first** cognitive gaming and assistance mobile app for elderly dementia patients in low-connectivity regions (North Eastern India focus).

**Primary operators:** Caregivers set up patients, upload personal memories, and monitor progress.  
**Primary end users:** Patients complete **two voice-first cognitive sessions per day** (morning family/memory recognition; evening identity/orientation) without typing.

**Ship goal:** One Expo React Native TypeScript app, installable as an **Android APK** via EAS Build, fully demoable offline with seeded data for hackathon judges.

**Hard constraint:** Core games, voice interaction, scoring, and session history must work with **zero internet**. Cloud sync is best-effort when connectivity returns.

**Medical disclaimer (show in-app):** This is a cognitive engagement and caregiver-monitoring tool, **not** a diagnostic or medical device. It does not replace professional clinical evaluation.

---

## 1. Product requirements

### 1.1 Personas

| Role | Goals | Interaction |
|------|--------|-------------|
| Caregiver | Create patient profile, upload memory photos + captions, start sessions, view trends/alerts | Standard mobile UI, forms OK |
| Patient | Complete guided morning/evening sessions; recall people/places/self | Voice-first; huge tap targets; no typing |

### 1.2 Core user journeys

1. **Caregiver onboarding (offline OK):** Open app → create local caregiver account (or skip auth in demo mode) → create patient profile (name, age, preferred language if available, dementia notes, hometown, key facts) → upload ≥3 memory photos with captions like “This is your daughter, Meera” → open caregiver home.
2. **Morning session (patient mode):** Caregiver taps “Start morning session” → large photo teach phase (TTS speaks caption) → quiz phase (“Who is this?”) → patient speaks answer → score stored locally → summary screen.
3. **Evening session:** Orientation questions from profile (“What is your name?”, “Where are you from?”, “Who is this person?”) + 1–2 memory checks → voice answers → local score → summary.
4. **Caregiver dashboard:** View today’s sessions, accuracy, response time, hints, 7-day trend chart, AI/rule-based insight (“stable / needs attention”).
5. **Sync (when online):** Pending SQLite rows + local images upload to Supabase; pull remote updates. If env keys missing, stay in **demo/local-only** mode without crashing.

### 1.3 Non-goals (do not build)

- Clinical diagnosis or clinician portals
- Multi-tenant SaaS billing / subscriptions
- Separate web dashboard (v1 is mobile-only)
- iOS TestFlight as a hard requirement (Android APK is the hackathon deliverable)
- Free-form patient typing
- Real PHI from judges’ devices — use seeded demo data only

---

## 2. Mandatory tech stack (production hybrid)

| Layer | Choice | Notes |
|-------|--------|--------|
| UI | **Vite + React 19 + TypeScript** | Edit screens/CSS freely; hot reload |
| Design | **`src/design/tokens.css` + `shared/ui.tsx`** | Global restyle without rewriting domain |
| Personas | **CaregiverShell / FamilyShell / PatientShell** | Nav chrome per role |
| Native | **Capacitor 8** | Android APK; `com.dementiasupport.app` |
| Local DB | **Dexie (IndexedDB)** | Offline source of truth |
| Voice | Web Speech APIs + chip fallback | Patient: no typing |
| State | **Zustand** + light **Framer Motion** | Keep simple |
| Cloud | **Supabase** (optional) | Graceful offline if keys missing |
| Build | `npm run build` → `npx cap sync android` | APK via Android Studio |

**Ship folder:** `app/` only. Do **not** revive Expo `mobile/` unless explicitly requested.

**Do not** rewrite in Flutter or pure native for v1; hybrid web+Capacitor is the production path for rapid UI iteration.

---

## 3. App information architecture

### 3.1 Route map (React Router in `app/src/App.tsx`)

```
/disclaimer
/onboarding/caregiver
/                         # caregiver home
/family                   # family hub
/patient/new | /patient/:id/edit | /patient/:id/memories
/progress | /settings
/patient-mode
/session/start | /session/play | /session/summary
```

### 3.1b Archived Expo route map (reference only — implemented under `/mobile`)

```
app/
  _layout.tsx
  index.tsx
  (caregiver)/home.tsx
  (patient)/session/*
```

### 3.2 Flow diagram

```
Caregiver Login/Demo
    → Home
        → Patients / Profile / Memories
        → Dashboard / Trends
        → Start Session → Patient Mode
              → Morning: Teach → VoiceQuiz → Summary
              → Evening: Orient → VoiceQuiz → Summary
                    → LocalStore → (online) CloudSync
```

---

## 4. Data model

### 4.1 SQLite schema (local source of truth)

Implement migrations in `src/db/migrations.ts` and a thin repository layer in `src/db/repos/`.

```sql
-- caregivers (local demo may use a single row)
CREATE TABLE caregivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' -- pending|synced|error
);

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  preferred_name TEXT,
  age INTEGER,
  hometown TEXT,
  dementia_notes TEXT,
  medical_recommendations TEXT,
  language_code TEXT DEFAULT 'en-IN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  local_uri TEXT NOT NULL,          -- file:// path
  remote_url TEXT,                  -- after upload
  caption TEXT NOT NULL,            -- "This is your daughter, Meera"
  short_label TEXT NOT NULL,        -- "Meera" / "daughter" for matching
  aliases TEXT,                     -- JSON array of acceptable answers
  category TEXT,                    -- person|place|object
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  session_type TEXT NOT NULL,       -- morning|evening
  started_at TEXT NOT NULL,
  ended_at TEXT,
  accuracy REAL,                    -- 0..1
  avg_response_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  composite_score REAL,             -- 0..100
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE session_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  item_type TEXT NOT NULL,          -- memory_teach|memory_quiz|orientation
  memory_id TEXT,
  prompt_text TEXT NOT NULL,
  expected_answers TEXT NOT NULL,   -- JSON string array
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE responses (
  id TEXT PRIMARY KEY,
  session_item_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  transcript TEXT,
  is_correct INTEGER NOT NULL,      -- 0|1
  response_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  match_score REAL,                 -- fuzzy match 0..1
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (session_item_id) REFERENCES session_items(id)
);

CREATE TABLE caregiver_alerts (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  severity TEXT NOT NULL,           -- info|watch|attention
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,          -- upsert|delete
  payload TEXT,                     -- JSON
  created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_error TEXT
);
```

### 4.2 Supabase (mirror when configured)

Provide `supabase/schema.sql` matching the tables above (UUID PKs, RLS per caregiver). Storage bucket: `memories` (private). Auth: email/password or magic link; **demo mode** skips cloud and uses local caregiver id `demo-caregiver`.

Env vars (Expo public):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_DEMO_MODE=true
```

If URL/key empty OR `DEMO_MODE=true`, never throw on sync; show “Local only” badge on caregiver home.

---

## 5. Session engine (business logic)

Implement in `src/sessions/engine.ts` — pure, testable functions.

### 5.1 Morning session

1. Select 3–5 memories (prefer less-practiced / lower historical accuracy).
2. **Teach phase** per memory: full-bleed photo, caption on screen, TTS speaks caption once; caregiver/patient taps Next (or auto-advance after TTS + 2s).
3. **Quiz phase:** shuffle those memories; for each: show photo (no caption), TTS: “Who is this?”; start listening; record `response_ms`.
4. Grade with fuzzy match against `short_label`, `aliases`, and key tokens from `caption` (case-insensitive, strip punctuation; accept partial contains / Levenshtein threshold).
5. Controls always visible: **Repeat** (replay TTS + optionally re-listen), **Hint** (speak first syllable or relationship word; increment hints), **Skip** (mark incorrect), **Next**.

### 5.2 Evening session

Build item list from patient profile:

- “What is your name?” → expected: `preferred_name` / `full_name`
- “Where are you from?” → `hometown`
- Optional: “How old are you?” → age as spoken number or digits
- 1–2 memory quiz items as in morning

Same voice grading and metrics.

### 5.3 Scoring

Per session:

- `accuracy` = correct / answered (skip counts as incorrect)
- `avg_response_ms` = mean of response times on answered items
- `hints_used`, `repetitions` = sums
- `composite_score` = `accuracy * 70 + speed_component * 20 + (1 - hint_penalty) * 10`  
  - Clamp 0–100  
  - `speed_component`: 1 if avg ≤ 5s, linear down to 0 at ≥ 30s  
  - `hint_penalty`: min(1, hints_used / (items * 2))

Persist session + items + responses immediately to SQLite; enqueue sync_queue rows.

### 5.4 Trend / “AI” insights (hackathon-realistic)

In `src/insights/trends.ts`:

- Compute 7-day and 30-day rolling accuracy and composite_score.
- Classify: `improving` | `stable` | `declining` | `insufficient_data`.
- Rules: declining if last 3 sessions avg accuracy ≥15 points below prior 3; improving inverse; else stable.
- Generate caregiver-facing sentence (template-based offline). If online and an optional `EXPO_PUBLIC_OPENAI_API_KEY` exists, optionally enrich with one short LLM summary; **must work without it**.
- On declining + severity watch/attention, insert `caregiver_alerts` row.

---

## 6. Voice-first UX rules

### 6.1 Patient mode visual design

- High contrast: dark text on soft warm off-white / sage backgrounds (avoid purple-glow AI clichés and harsh pure white flash).
- Minimum primary button height **72dp**; font sizes ≥ **28sp** for prompts, ≥ **22sp** body.
- One question, one photo, few controls — no dashboards in patient mode.
- Visible **listening** indicator (pulse ring) when STT active.
- Calm copy: respectful adult tone; never childish or clinical jargon.

### 6.2 Caregiver mode

- Clear hierarchy: Home → Patient → Memories → Dashboard.
- Sync status chip: Online / Offline / Syncing / Local only.
- Large photo picker; caption + short_label + aliases fields; category chips.

### 6.3 STT failure fallback

If microphone permission denied or recognition errors twice:

- Show 3–4 large answer chips (1 correct + distractors from other memories / profile).
- Still record response timing and correctness.
- Never force a keyboard for the patient.

### 6.4 Accessibility

- TalkBack-friendly labels on all controls.
- Do not rely on color alone for correct/incorrect (use icons + text).

---

## 7. Offline-first & sync

### 7.1 Principles

1. **All reads/writes go to SQLite first.**
2. Images saved under app document directory; store `local_uri`.
3. NetInfo listener: on `isConnected`, run `syncService.flush()`.
4. `flush()`: process `sync_queue` FIFO; upload images then upsert rows; mark `sync_status='synced'`; pull remote changes for this caregiver (if authenticated).
5. Conflicts: last-writer-wins on `updated_at` (ISO strings). Document this in code comments.
6. Never block session completion on network.

### 7.2 Demo seed

On first launch in demo mode, seed:

- Caregiver: “Demo Caregiver”
- Patient: “Anjali Devi”, age 72, hometown “Imphal”, notes mild dementia
- 4 memories with bundled placeholder images in `assets/demo/` + captions/aliases
- 5 historical sessions with varied scores so dashboard charts are non-empty

Provide a “Reset demo data” in Settings.

---

## 8. UI / branding

- App display name: **DementiaSupport**
- Tagline (settings/about only, not cluttering patient UI): “Personalized memory care, even offline.”
- Define CSS/theme tokens in `src/theme/tokens.ts`: colors, spacing, typography (use expressive fonts via `expo-font` — e.g. a readable soft sans for UI + slightly warmer display for caregiver headlines; avoid Inter/Roboto defaults if easy; prefer something like `Nunito` / `Source Sans 3` loaded locally).
- Icon + splash: calm, abstract memory/leaf motif — generate simple assets or solid-color placeholder with app name; must not crash build.
- Motion: subtle fade/slide between session steps; listening pulse; avoid noisy animations.

---

## 9. Project structure

```
/
  app/                      # Expo Router screens
  src/
    db/                     # sqlite, migrations, repos
    sessions/               # engine, grading, builders
    insights/               # trends, alerts
    sync/                   # netinfo, supabase client, flush
    voice/                  # tts, stt, permissions
    store/                  # zustand
    theme/
    components/
      caregiver/
      patient/
      ui/
    utils/                  # fuzzyMatch, time, ids
  assets/
    demo/
    fonts/
    images/
  supabase/
    schema.sql
  eas.json
  app.json / app.config.ts
  README.md                 # already exists — update run/APK sections if needed
```

---

## 10. EAS / APK ship checklist

1. `app.config.ts`: `name`, `slug: dementiasupport`, `android.package: com.dementiasupport.app`, permissions: `RECORD_AUDIO`, `INTERNET`, `ACCESS_NETWORK_STATE`, camera/library as needed for memory upload.
2. `eas.json`:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": { "buildType": "apk" },
      "distribution": "internal"
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

3. Document: `npx eas-cli login` → `eas build -p android --profile preview` → download APK URL.
4. Local fallback for judges without EAS: `npx expo run:android` if device/emulator available.
5. Include **3-minute demo script** in README (caregiver add memory → morning session with chips if no mic → dashboard trends).

---

## 11. Quality bar

- TypeScript strict; no `any` unless justified with comment.
- Error boundaries on root and patient session.
- Empty states for no patient / no memories / no sessions.
- Loading and disabled states on sync buttons.
- Unit tests for: `fuzzyMatch`, session scoring, trend classification (`src/**/*.test.ts` with Jest or vitest as Expo-compatible).
- README: setup, env, demo mode, APK build, disclaimer.

---

## 12. Acceptance criteria (must all pass)

- [ ] `npx expo start` launches without redbox on a clean install in demo mode
- [ ] Caregiver can create/edit patient and add ≥3 memories **offline**
- [ ] Patient can complete **morning** and **evening** sessions **offline** (STT or chip fallback)
- [ ] Session metrics (accuracy, response time, hints, repetitions, composite) persist in SQLite and show on caregiver dashboard
- [ ] Trend classification + at least one alert path works with seeded history
- [ ] Sync service no-ops safely in demo mode; with Supabase env, queue flushes without data loss on happy path
- [ ] `eas.json` preview profile produces **APK** (or documented `expo run:android`)
- [ ] UI readable at arm’s length; patient mode has no typing requirement
- [ ] In-app medical disclaimer present
- [ ] Seeded demo data enables a full judge walkthrough without cloud

---

## 13. Implementation order (follow unless blocked)

1. Scaffold Expo + Router + theme + SQLite migrations  
2. Caregiver patient + memories CRUD (local)  
3. Session engine + morning/evening UI + scoring  
4. Voice TTS/STT + chip fallback  
5. Dashboard + insights + alerts  
6. Sync service + Supabase schema (optional path)  
7. Demo seed + polish + EAS APK config  
8. Tests for core pure functions + README demo script  

Stop after each phase only to verify the checklist items for that phase; then continue until all acceptance criteria are met.

---

## 14. Agent behavior rules

- Implement the full app; do not stop at stubs for core flows.
- Prefer small, focused files; match structure above.
- Never claim medical efficacy in UI copy.
- If a native STT library fails on Expo Go, document that **development builds / APK** are required for mic, and ensure chip fallback works in Expo Go so demos never die.
- When finished, summarize: how to run, how to build APK, demo path, and any known limitations.

---

**END OF MASTER BUILD PROMPT — BUILD DementiaSupport NOW.**
