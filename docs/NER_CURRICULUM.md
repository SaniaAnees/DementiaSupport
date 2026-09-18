# NER curriculum packs (Seven Sisters)

Hometown / `region_state` on the patient record is resolved by `server/curriculum/geo.js`.  
`builder.js` loads `server/curriculum/packs/<code>/` for that state.

| Code | State | Day-1 morning / evening | Signature teach words |
|------|--------|-------------------------|------------------------|
| `as` | Assam | ✅ | Pitha, Brahmaputra, Bihu, Jaapi, Gamusa |
| `ml` | Meghalaya | ✅ | Jadoh, Living root bridge, Wangala, Jainsem |
| `mn` | Manipur | ✅ | Eromba, Loktak, Yaoshang, Phanek |
| `nl` | Nagaland | ✅ | Smoked pork, Hornbill, Dzukou, Naga shawl |
| `mz` | Mizoram | ✅ | Bai, Chapchar Kut, Phawngpui, Puan |
| `tr` | Tripura | ✅ | Mui borok, Neermahal, Kharchi, Risha |
| `ar` | Arunachal Pradesh | ✅ | Thukpa, Tawang, Losar, Gale |

## How detection works

1. Caregiver sets **hometown** (e.g. Shillong, Imphal, Kohima) and/or **region_state**.
2. `resolveRegion()` maps aliases → state code.
3. Session build uses that pack’s `day1.morning.json` / `day1.evening.json`.
4. If a pack were missing, builder falls back to Assam — all seven packs now exist.

## Regenerate

```powershell
node scripts/generate_ner_packs.js
```

Writes both `server/curriculum/packs/` and `public/curriculum/packs/` (offline PWA).

Images under `/assets/curriculum/<code>/` are **real Wikimedia Commons photos** (no emojis).  
Re-download with `powershell -File scripts/download_ner_images.ps1`. See `public/assets/curriculum/ATTRIBUTION.md`.
