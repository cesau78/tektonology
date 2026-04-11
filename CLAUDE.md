# Tektonology — Project Conventions

## Imperatives

Decision heuristics (Reduce Suffering, Increase Prosperity, Increase Understanding) live in **`heuristic-imperatives.md`** at the repository root — that file is the single source of truth. Cursor’s always-on rule points there via `.cursor/rules/tektonology-imperatives.mdc`.

## General

- This is a church/home maintenance system (web, data, agents) with a strong 3D-printing strand so parishioners can contribute printable parts.
- Primary languages: OpenSCAD (models), TypeScript/React (web)
- Preferred Langugage: NodeJS

## JSON

- All JSON keys must be **camelCase** (e.g., `printSettings`, `upperBoot`, `floorPad`).
- Human-readable labels are derived from keys at render time — do not use display strings as keys.

## Directory Structure

```
3d-models/                     # OpenSCAD source and generated STL files
  kneeler-replacement-parts/   # Pew kneeler boots and bushings
mongo-db/                      # MongoDB — models and local data
  data/                        # Local MongoDB bind mount (gitignored)
  *.ts                         # Shared document interfaces (TypeScript)
tektonology-api/               # Express API — Auth0 + MongoDB
services/                      # Backend services (local agents)
  printing-agent/              # MQTT daemon — detects print completion, writes raw print_jobs
  accounting-agent/            # Polls unprocessed print_jobs, updates spools + journal_entries
tektonology-spa/               # Next.js static site (tektonology.com)
  app/                         # Next.js App Router pages
  data/
    products/                  # One JSON file per product
    batches/                   # One JSON file per print batch
```

## Prayer Sole v3 (compound fastened) — STL export

**Preview vs production:** local / default CI step uses `stamp-config.json` **`preview`: `true`** (fast mesh, `$fn=32`) and writes **`latest-builds/<version>-prototype/`**. **`KBCF_PRODUCTION=1`** forces **`preview=false`**, **`$fn=128`**, and **`latest-builds/<version>/`**. GitHub Actions `kneeler-boot-compound-fastened-build.yml` runs prototype export on every push to `main`, then production export and may commit updated production STLs.

## Web / Next.js

- Static export only (`output: "export"`) — no server-side runtime.
- Product and batch data lives in `tektonology-spa/data/` as JSON files, loaded at build time via `readFileSync`.
- `PrintSettings` is `Record<string, string>` with camelCase keys; the UI converts them to title-case labels for display.
