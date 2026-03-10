// --- TEKTONOLOGY FASTENED KNEELER BOOT — BOLT DRYING RACK PLATE ---
// Print 2 per rack: top holds bolt heads, bottom limits thread exposure.
// Insert non-flanged end first; flange stops against the first leg face.
include <bolt-drying-rack-config.scad>

module plate() {
    union() {
        difference() {
            cube([plate_x, plate_y, plate_thick]);
            for (r = [0 : rows - 1])
                for (c = [0 : cols - 1])
                    translate([
                        hole_x0 + c * spacing + (r % 2) * stagger,
                        edge_margin + r * row_spacing,
                        -0.1
                    ])
                        cylinder(h = plate_thick + 0.2, d = hole_dia, $fn = $fn);
        }

        // End-stop flange at -X end: taller than slot, catches on leg face
        cube([stop_width, plate_y, plate_thick + stop_extra]);
    }
}

plate();
