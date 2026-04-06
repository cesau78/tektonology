// --- TEKTONOLOGY PRAYER SOLE V3 — ASSEMBLY / INTERFERENCE VIEW ---
// Diagnostic visualization: renders cap and collar together to reveal
// interference (overlapping material) between the two parts.
//
// mode = "interference"  ���  ghost parts + solid red overlap volume
// mode = "assembly"      →  both parts colored, no overlap highlight
// mode = "exploded"      →  parts pulled apart along their assembly axes

mode = "exploded"; // "interference", "assembly", or "exploded"

include <config.scad>
use <cap.scad>
use <collar.scad>
use <tread.scad>

// Tread top flush with bottom of separator (top of bottom socket)
// Tread core top in local coords = socket_depth/2 + (socket_depth + core_protrusion)/2 = 6
tread_top_local = 6;
separator_bottom = -(total_h / 2) + bottom_target_depth;
tread_z = separator_bottom - tread_top_local;

// Exploded view offsets
explode_tread_z = -18;   // tread drops down
explode_cap_x   =  20;   // cap slides out along bolt axis
explode_bolt_x  =  35;   // bolts further out than cap
explode_nut_x   = -15;   // nuts shift toward collar side

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
    } else if (mode == "exploded") {
        // Exploded view — parts separated along assembly axes
        color("Maroon") collar();
        color("Maroon") translate([explode_cap_x, 0, 0]) cap();
        color("Black")  translate([0, 0, tread_z + explode_tread_z]) main();

        // Bolts — exploded further than cap
        head_start_x = outer_extent - head_height;
        color("Silver")
            translate([explode_bolt_x, 0, 0])
            for (pos = bolt_positions) {
                translate([head_start_x - bolt_length, pos[1], pos[0]])
                    rotate([0, 90, 0])
                        cylinder(h=bolt_length, d=bolt_dia, center=false);
                translate([head_start_x, pos[1], pos[0]])
                    rotate([0, 90, 0])
                        cylinder(h=head_height, d=head_dia, center=false);
            }

        // Nuts — exploded toward collar side
        nut_r = nut_af / 2 / cos(30);
        color("Silver")
            translate([explode_nut_x, 0, 0])
            for (pos = bolt_positions) {
                rot = (pos[1] > 0) ? 15 : -15;
                translate([nut_x, pos[1], pos[0]])
                    rotate([0, 90, 0])
                        rotate([0, 0, rot])
                            cylinder(h=nut_thickness, r=nut_r, $fn=6, center=true);
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
