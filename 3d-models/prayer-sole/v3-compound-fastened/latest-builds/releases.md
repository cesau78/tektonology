# Prayer Sole v3 (compound fastened) — `latest-builds`

STL exports for the fastened Prayer Sole system (TPU tread + PLA collar shell + cap). The tread stamp is driven by `stamp-config.json` (or another JSON you pass to the export script): line 1 = **`brand_name`** (e.g. **Tektonology**, large); optional line 2 = **`product_name`** (leave empty to skip; lines 3–4 compact upward); with **`stamp_show_version_line`** `false`, line 3 = **`stamp_line3`** (e.g. **Foundation v3.8.1**); line 4 = **`stamp_line4`** (e.g. **Psalm 145:14**, tertiary).

## Layout

- **`v3.x.y/`** — production exports: `KBCF_PRODUCTION=1`, OpenSCAD **`preview=false`**, **`$fn=128`** (slow mesh).
- **`v3.x.y-prototype/`** — local default and first CI step: no `KBCF_PRODUCTION`, uses **`stamp-config.json` → `preview`** (committed default **`true`**), **`$fn=32`**, faster STLs.

GitHub Actions on **push to `main`** runs prototype export, a smoke render, then production export. **Manual workflow** can skip production via the dispatch input.

See **`releases.md`** in each version folder for commit/tag notes when present.

## Stamp orientation

The TPU **tread** carries a debossed stamp on its **top** face (the flat that faces into the coupler), hidden after assembly.

## Export

From `3d-models/prayer-sole/v3-compound-fastened`:

- **PowerShell:** `.\scripts\Export-OpenScadStl.ps1`
- **Bash:** `./scripts/export-open-scad-stl.sh`

Optional config: pass path to a JSON with the same shape as `stamp-config.json`.

## Artifacts (per version folder)

| File | Role |
|------|------|
| `tread.stl` | TPU tread (top-face stamp when enabled) |
| `collar.stl` | PLA collar half |
| `cap.stl` | PLA cap |
