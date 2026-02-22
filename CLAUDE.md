# Tektonology — Project Conventions

## Imperatives

When making decisions — about design, naming, architecture, or implementation — apply these in order:

1. **Reduce Suffering** — prefer solutions that remove friction, eliminate toil, and avoid creating problems for people downstream.
2. **Increase Prosperity** — prefer solutions that create lasting value, are reusable, and support the project's mission.
3. **Increase Understanding** — prefer solutions that are clear, well-named, and easy to reason about over clever or opaque ones.

## General

- This is a church/home maintenance asset repo with 3D-printable solutions.
- Primary languages: OpenSCAD (models), TypeScript/React (web).

## JSON

- All JSON keys must be **camelCase** (e.g., `printSettings`, `upperBoot`, `floorPad`).
- Human-readable labels are derived from keys at render time — do not use display strings as keys.

## Directory Structure

```
models/
  kneeler-replacement-parts/   # Pew kneeler boots and bushings
  liquid-bait-station/         # Pest control
web/                           # Next.js static site (tectonology.com)
  app/                         # Next.js App Router pages
  data/
    products/                  # One JSON file per product
    batches/                   # One JSON file per print batch
```

## Web / Next.js

- Static export only (`output: "export"`) — no server-side runtime.
- Product and batch data lives in `web/data/` as JSON files, loaded at build time via `readFileSync`.
- `PrintSettings` is `Record<string, string>` with camelCase keys; the UI converts them to title-case labels for display.
