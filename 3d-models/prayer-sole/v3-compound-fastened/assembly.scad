// --- TEKTONOLOGY PRAYER SOLE V3 — ASSEMBLY / INTERFERENCE VIEW ---
// Diagnostic visualization: renders cap and collar together to reveal
// interference (overlapping material) between the two parts.
//
// mode = "interference"  →  ghost parts + solid red overlap volume
// mode = "assembly"      →  both parts colored, no overlap highlight

mode = "assembly"; // "interference" or "assembly"

include <config.scad>
use <cap.scad>
use <collar.scad>
use <tread.scad>

// Tread top flush with bottom of separator (top of bottom socket)
// Tread core top in local coords = socket_depth/2 + (socket_depth + core_protrusion)/2 = 6
tread_top_local = 6;
separator_bottom = -(total_h / 2) + bottom_target_depth;
tread_z = separator_bottom - tread_top_local;

crosssection(big) {
    if (mode == "interference") {
        // Ghost all parts (transparent)
        %cap();
        %collar();
        %translate([0, 0, tread_z]) main();

        // Solid red: only the volume where any two parts occupy the same space
        color("red") intersection() {
            cap();
            collar();
        }
        color("red") intersection() {
            collar();
            translate([0, 0, tread_z]) main();
        }
        color("red") intersection() {
            cap();
            translate([0, 0, tread_z]) main();
        }
    } else {
        // Simple assembly view
        color("SteelBlue", 0.1) cap();
        color("SlateGray", 0.1) collar();
        color("DarkSlateGray", 0.1) translate([0, 0, tread_z]) main();
        debug_bolts();
        debug_nuts();
    }
}
