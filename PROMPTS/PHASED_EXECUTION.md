# DementiaSupport — Phased Execution Guide

Use this with [`MASTER_BUILD_PROMPT.md`](./MASTER_BUILD_PROMPT.md).  
In Cursor: run **one phase per Agent turn** (or continue in one long session if context allows). After each phase, complete the **Verify** checklist before starting the next.

---

## Phase 0 — Bootstrap

**Goal:** Empty repo becomes a runnable Expo TypeScript app with routing shell.

**Do:**
1. `npx create-expo-app@latest . --template tabs` (or blank with Expo Router) in the project root if no app exists. Prefer **TypeScript + Expo Router**.
2. Install deps: `expo-sqlite`, `expo-file-system`, `expo-speech`, `@react-native-community/netinfo`, `zustand`, `@tanstack/react-query`, `expo-image-picker`, `expo-font`, chart library of choice.
3. Configure `app.config.ts` / `app.json`: name `DementiaSupport`, slug `dementiasupport`, Android package `com.dementiasupport.app`, `RECORD_AUDIO` permission.
4. Create folder structure from the master prompt (`src/db`, `src/sessions`, etc.).
5. Add root providers in `app/_layout.tsx` (theme, QueryClient, DB init).

**Verify:**
- [ ] `npx expo start` opens without crash
- [ ] Placeholder caregiver + patient routes navigate
- [ ] TypeScript compiles

**Stop condition:** Do not build session logic yet.

---

## Phase 1 — Offline data layer

**Goal:** SQLite is the source of truth.

**Do:**
1. Implement migrations (`src/db/migrations.ts`) for all tables in the master prompt.
2. Repos: caregivers, patients, memories, sessions, responses, sync_queue, alerts.
3. UUID helper (`crypto.randomUUID` or `expo-crypto`).
4. Image helper: copy picked images into document directory; return `local_uri`.
5. First-launch seed for demo mode (`EXPO_PUBLIC_DEMO_MODE=true` default).

**Verify:**
- [ ] App creates DB on launch
- [ ] Seed inserts demo patient + ≥4 memories + historical sessions
- [ ] Settings “Reset demo data” recreates seed

**Stop condition:** No cloud sync yet (stub `syncService` as no-op).

---

## Phase 2 — Caregiver CRUD UI

**Goal:** Caregiver can manage patients and memories offline.

**Do:**
1. Screens: home, patient new/edit, memories list/add/edit.
2. Image picker + caption, short_label, aliases (comma-separated → JSON), category.
3. Empty states and basic validation (name required; memory needs photo + caption + short_label).
4. Sync status chip always shows “Local only” or “Offline” for now.

**Verify:**
- [ ] Create patient without network
- [ ] Add 3 memories with photos
- [ ] Edit caption persists after app reload

**Stop condition:** Do not start patient session UI yet.

---

## Phase 3 — Session engine (pure logic)

**Goal:** Testable builders + scoring + fuzzy match with no UI dependency.

**Do:**
1. `src/utils/fuzzyMatch.ts` — normalize, aliases, Levenshtein / contains.
2. `src/sessions/engine.ts` — `buildMorningSession`, `buildEveningSession`, `gradeAnswer`, `computeSessionScores`.
3. Unit tests for match + scoring + edge cases (empty transcript, skip).

**Verify:**
- [ ] Tests pass for correct/incorrect/hint scoring
- [ ] Morning returns teach then quiz items
- [ ] Evening includes name + hometown prompts when profile fields exist

**Stop condition:** Wire UI in Phase 4.

---

## Phase 4 — Patient sessions UI + voice

**Goal:** Complete morning and evening flows offline.

**Do:**
1. Patient layout: large type, high contrast, minimal chrome.
2. Morning: teach steps → quiz steps → summary.
3. Evening: orientation + memory quiz → summary.
4. TTS via `expo-speech` on every prompt.
5. STT integration **or** immediate chip fallback if library incompatible with Expo Go.
6. Persist session, items, responses to SQLite on completion; enqueue sync_queue.
7. Controls: Repeat, Hint, Skip, Next / Speak.

**Verify:**
- [ ] Full morning session completable offline (chips OK)
- [ ] Full evening session completable offline
- [ ] Summary shows accuracy, time, hints, composite score
- [ ] Reloading app still shows session on dashboard query

**Stop condition:** Dashboard polish in Phase 5.

---

## Phase 5 — Caregiver dashboard + insights

**Goal:** Trends and alerts for caregivers.

**Do:**
1. Dashboard: today’s sessions, 7-day chart, metric cards.
2. `src/insights/trends.ts` — classify improving/stable/declining/insufficient_data.
3. Generate template insight sentence; create `caregiver_alerts` when declining.
4. Alerts list on home or dashboard; mark read.

**Verify:**
- [ ] Seeded history shows a non-flat chart
- [ ] Classification returns a defined state
- [ ] Declining path can create an alert (force with test data if needed)

**Stop condition:** Sync in Phase 6.

---

## Phase 6 — Cloud sync (optional path)

**Goal:** Online flush without breaking offline demo.

**Do:**
1. `supabase/schema.sql` + Storage bucket notes.
2. Supabase client; auth optional (email) — demo skips.
3. `syncService.flush()` processes queue; uploads images; upserts rows.
4. NetInfo auto-flush on reconnect.
5. UI: Sync now button; status chip Online/Offline/Syncing/Local only.
6. If env missing: no-op, no crash.

**Verify:**
- [ ] Demo mode: sync button harmless
- [ ] With keys: one patient + memory round-trips (manual test documented)
- [ ] Session completion never waits on network

---

## Phase 7 — Polish, EAS APK, demo script

**Goal:** Hackathon-shippable artifact.

**Do:**
1. App icon, splash, fonts, disclaimer screen/modal (first launch + About).
2. `eas.json` preview → APK; confirm `android.package`.
3. Error boundaries; permission rationale copy for mic.
4. Update root README: run, env, demo script (3 min), APK commands, limitations (STT may need dev/APK build).
5. Smoke-test acceptance criteria from master prompt.

**Verify:**
- [ ] All acceptance criteria in `MASTER_BUILD_PROMPT.md` §12 checked
- [ ] `eas build -p android --profile preview` config valid (`eas.json` present)
- [ ] Judge can follow 3-minute demo without cloud

---

## Phase 8 — Hardening (if time)

**Do:**
- Loading/disabled states, better empty states
- Localization stub (`en-IN` string table) for 5–10 key patient prompts
- Performance: avoid re-renders on listening pulse
- Privacy blurb: data local-first; no medical claims

**Verify:**
- [ ] No redbox on common paths
- [ ] Disclaimer visible

---

## Suggested Agent prompts (copy-paste)

### Start Phase 0
```
Read PROMPTS/MASTER_BUILD_PROMPT.md and PROMPTS/PHASED_EXECUTION.md.
Execute Phase 0 only. Stop after Verify checklist.
```

### Continue
```
Phase N-1 is done. Execute Phase N from PROMPTS/PHASED_EXECUTION.md only.
Follow MASTER_BUILD_PROMPT constraints. Stop after that phase's Verify checklist.
```

### Final sweep
```
Run Phase 7–8. Ensure all acceptance criteria in MASTER_BUILD_PROMPT §12 pass.
Summarize how to run, demo, and build the APK.
```

---

## Dependency order (do not reorder)

```
Phase0 → Phase1 → Phase2 → Phase3 → Phase4 → Phase5 → Phase6 → Phase7 → Phase8
```

Phase 3 may start in parallel with Phase 2 **only if** two agents coordinate; otherwise keep sequential to avoid merge conflicts.
