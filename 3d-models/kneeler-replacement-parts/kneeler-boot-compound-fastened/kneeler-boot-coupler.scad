// --- TEKTONOLOGY KNEELER BOOT COUPLER — Assembly View ---
// Shows both pieces together for fit-check. Open the individual files
// for rendering/exporting each piece:
//   kneeler-boot-slipper.scad
//   kneeler-boot-cap.scad
include <kneeler-boot-config.scad>
use <kneeler-boot-slipper.scad>
use <kneeler-boot-cap.scad>


crosssection(leg_l) {
    slipper();
    translate([10, 0, 0]) cap(); // exploded gap for visibility
}
