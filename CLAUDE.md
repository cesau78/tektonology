# Tektonology — Project Conventions

## Imperatives

When making decisions — about design, naming, architecture, or implementation — apply these in order:

1. **Reduce Suffering** — prefer solutions that remove friction, eliminate toil, and avoid creating problems for people downstream.
2. **Increase Prosperity** — prefer solutions that create lasting value, are reusable, and support the project's mission.
3. **Increase Understanding** — prefer solutions that are clear, well-named, and easy to reason about over clever or opaque ones.

## General

- This is a church/home maintenance asset repo with 3D-printable solutions.
- Primary languages: OpenSCAD (models), TypeScript/React (web)
- Preferred Langugage: NodeJS

## JSON

- All JSON keys must be **camelCase** (e.g., `printSettings`, `upperBoot`, `floorPad`).
- Human-readable labels are derived from keys at render time — do not use display strings as keys.

## Directory Structure

```
3d-models/                     # OpenSCAD source and generated STL files
  kneeler-replacement-parts/   # Pew kneeler boots and bushings
  liquid-bait-station/         # Pest control
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

## Web / Next.js

- Static export only (`output: "export"`) — no server-side runtime.
- Product and batch data lives in `tektonology-spa/data/` as JSON files, loaded at build time via `readFileSync`.
- `PrintSettings` is `Record<string, string>` with camelCase keys; the UI converts them to title-case labels for display.
