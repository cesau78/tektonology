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

function build(openscad, scad, { output, defines = {} } = {}) {
  const stl = output ?? scad.replace(/\.scad$/, ".stl");
  console.log(`  Building: ${stl}`);
  const args = ["-o", stl];
  for (const [k, v] of Object.entries(defines)) args.push("-D", `${k}=${v}`);
  args.push(scad);
  const result = spawnSync(openscad, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`  FAILED: ${scad}`);
    process.exit(result.status ?? 1);
  }
}

const openscad = findOpenSCAD();
const ciOverrides = { preview: "false", crosssection_view: "false" };

const fastened = "3d-models/kneeler-replacement-parts/kneeler-boot-compound-fastened";

console.log("==> kneeler-boot-compound-fastened (slipper)");
build(openscad, resolve(`${fastened}/kneeler-boot-slipper.scad`), { defines: ciOverrides });

console.log("==> kneeler-boot-compound-fastened (cap)");
build(openscad, resolve(`${fastened}/kneeler-boot-cap.scad`), { defines: ciOverrides });

console.log("==> kneeler-boot-compound-fastened (insert)");
build(openscad, resolve(`${fastened}/kneeler-boot-insert.scad`), { defines: ciOverrides });

console.log("==> kneeler-bushing");
build(openscad, resolve("3d-models/kneeler-replacement-parts/kneeler-bushing/kneeler-bushing.scad"), { defines: ciOverrides });

console.log("Done.");
