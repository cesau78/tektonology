#!/usr/bin/env node
// Generate STL files from OpenSCAD source.
// Usage: node scripts/build-stls.mjs
//        npm run build:stls   (from repo root)

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Locate OpenSCAD — prefer PATH, fall back to Windows default install.
function findOpenSCAD() {
  const { status } = spawnSync("openscad", ["--version"], { stdio: "ignore" });
  if (status === 0) return "openscad";

  const winDefault = "C:\\Program Files\\OpenSCAD\\openscad.exe";
  if (existsSync(winDefault)) return winDefault;

  console.error("ERROR: openscad not found. Install from https://openscad.org/downloads.html");
  process.exit(1);
}

function build(openscad, scad) {
  const stl = scad.replace(/\.scad$/, ".stl");
  console.log(`  Building: ${stl}`);
  const result = spawnSync(openscad, ["-o", stl, scad], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`  FAILED: ${scad}`);
    process.exit(result.status ?? 1);
  }
}

const openscad = findOpenSCAD();

console.log("==> kneeler-bushing");
build(openscad, resolve("models/kneeler-replacement-parts/kneeler-bushing/kneeler-bushing.scad"));

console.log("Done.");
