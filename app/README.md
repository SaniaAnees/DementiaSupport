# DementiaSupport MVP (`app/`)

Real onboarding — **no demo patients or seed data**. Fresh install walks caregivers through setup.

## First-run experience (APK / web)
1. Disclaimer & consent framing  
2. Caregiver name + **your own 4-digit PIN**  
3. Patient profile (language, notes, morning/evening times)  
4. Upload **at least 3 real family photos** (relation chips + optional voice label)  
5. Caregiver home → patient lock mode  

## Run
```bash
npm install
npm run dev
```

## Offline
Sessions, scores, and history work with airplane mode on. Sync is optional (Settings consent).

## APK
```bash
npm run build
npx cap sync android
npx cap open android
```
Android Studio → **Build → Build APK(s)**. Anyone who installs gets the same empty-start setup flow.

## Erase
Settings → Erase all local data (returns to onboarding).
