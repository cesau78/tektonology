// --- TEKTONOLOGY PRAYER SOLE V3 — COUPLER ASSEMBLY VIEW ---
// Shows both pieces together for fit-check. Open the individual files
// for rendering/exporting each piece:
//   collar.scad
//   cap.scad
include <config.scad>
use <collar.scad>
use <cap.scad>


crosssection(sole_plate_l) {
    collar();
    translate([10, 0, 0]) cap(); // exploded gap for visibility
}
