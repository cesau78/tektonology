// --- TEKTONOLOGY KNEELER BOOT — ASSEMBLY / INTERFERENCE VIEW ---
// Diagnostic visualization: renders cap and slipper together to reveal
// interference (overlapping material) between the two parts.
//
// mode = "interference"  →  ghost parts + solid red overlap volume
// mode = "assembly"      →  both parts colored, no overlap highlight

mode = "assembly"; // "interference" or "assembly"

include <kneeler-boot-config.scad>
use <kneeler-boot-cap.scad>
use <kneeler-boot-slipper.scad>
use <kneeler-boot-insert.scad>

// Insert top flush with bottom of separator (top of bottom socket)
// Insert core top in local coords = socket_depth/2 + (socket_depth + core_protrusion)/2 = 6
insert_top_local = 6;
separator_bottom = -(total_h / 2) + bottom_target_depth;
insert_z = separator_bottom - insert_top_local;

crosssection(big) {
    if (mode == "interference") {
        // Ghost all parts (transparent)
        %cap();
        %slipper();
        %translate([0, 0, insert_z]) main();

        // Solid red: only the volume where any two parts occupy the same space
        color("red") intersection() {
            cap();
            slipper();
        }
        color("red") intersection() {
            slipper();
            translate([0, 0, insert_z]) main();
        }
        color("red") intersection() {
            cap();
            translate([0, 0, insert_z]) main();
        }
    } else {
        // Simple assembly view
        color("SteelBlue", 0.1) cap();
        color("SlateGray", 0.1) slipper();
        color("DarkSlateGray", 0.1) translate([0, 0, insert_z]) main();
        debug_bolts();
        debug_nuts();
    }
}
