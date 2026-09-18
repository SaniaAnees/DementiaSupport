# Offline voice architecture (MindCare)

## Ladder (no Gemini in the hot path)

| Surface | Voice |
|---|---|
| **Phone (Flutter)** | **Sherpa ONNX** (on-device) + answer chips |
| **Web PWA** | **Web Speech** + answer chips |

Cloud Gemini / Whisper STT is **disabled** for product demos (free-tier rate limits break always-on listen). Server route `/api/speech` remains for optional future use if you set keys in `.env`.

## Sherpa on phones

Models under `apps/flutter/assets/models/` (gitignored `*.onnx`; packed into APK on build):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download_sherpa_models.ps1
cd apps\flutter
flutter pub get
flutter run
```

## Web PWA

- Continuous mic via `VoiceLayer.startCallChannel` (browser Web Speech)
- If STT fails → tap Morning/Evening or answer chips
- Voice only on patient screens — never caregiver
