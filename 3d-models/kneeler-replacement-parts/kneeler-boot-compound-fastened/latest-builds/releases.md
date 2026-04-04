# Kneeler slipper (fastened) — `latest-builds`

STL exports for the fastened kneeler slipper system (TPU insert + PLA slipper shell + cap). The insert stamp is driven by `print-stamp-config.json` (or another JSON you pass to the export script): line 1 = **`brand_name`** (e.g. **Tektonology**, large); optional line 2 = **`product_name`** (leave empty to skip; lines 3–4 compact upward); with **`stamp_show_version_line`** `false`, line 3 = **`stamp_line3`** (e.g. **Foundation v3.8.1**); line 4 = **`stamp_line4`** (e.g. **Psalm 145:14**, tertiary).

**Optional custom line:** set **`product_name`** for a second-line message. **Many variants:** copy the config or start from `stamp-variants/example-minimal.json` (no custom line) / `stamp-variants/example-custom-message.json` (sample **Grace** line). Then export with that file:

- Bash: `./scripts/export-open-scad-stl.sh stamp-variants/example-custom-message.json`  
- PowerShell: `.\scripts\Export-OpenScadStl.ps1 -ConfigPath (Join-Path $PWD 'stamp-variants\example-custom-message.json')`  

Or set **`KBCF_STAMP_CONFIG`** to a config path (bash). STLs and `stamp_generated.scad` always land in this product folder.

Stamp line 3 is built from **`product_version`** and **`preview`** only when **`stamp_show_version_line`** is true (adds ` Prototype` when `preview` is true and the build is not production).

The TPU **insert** carries a debossed stamp on its **top** face (the flat that faces into the coupler), hidden after assembly.

## Output layout

Paths in `print-stamp-config.json` use `{version_folder}`, expanded by the export scripts:

| Build | Output folder | Stamp |
|--------|----------------|--------|
| Default; Actions *Kneeler boot compound fastened — build* on push to `main` | `latest-builds/<product_version>-prototype/` | Folder only; stamp text per JSON (e.g. no ` Prototype` when `preview` is false) |
| Production (`KBCF_PRODUCTION=1`, e.g. workflow with production export) | `latest-builds/<product_version>/` | Same stamp rules; output folder drops `-prototype` |

## Artifacts

| File | Part |
|------|------|
| `kneeler-boot-insert.stl` | TPU insert (top-face stamp when enabled) |
| `kneeler-boot-slipper.stl` | PLA slipper half |
| `kneeler-boot-cap.stl` | PLA cap |

## Regenerate locally

From `3d-models/kneeler-replacement-parts/kneeler-boot-compound-fastened`:

- **PowerShell:** `.\scripts\Export-OpenScadStl.ps1`
- **Bash:** `chmod +x scripts/export-open-scad-stl.sh && ./scripts/export-open-scad-stl.sh`

Production folder locally: `KBCF_PRODUCTION=1 ./scripts/export-open-scad-stl.sh` (bash) or `$env:KBCF_PRODUCTION='1'; .\scripts\Export-OpenScadStl.ps1` (PowerShell).
