// --- TEKTONOLOGY FASTENED KNEELER BOOT — BOLT DRYING RACK ASSEMBLY ---
// Exploded assembly view. Print parts from separate files:
//   bolt-drying-rack-plate.scad  (print 2)
//   bolt-drying-rack-leg.scad    (print 2)
include <bolt-drying-rack-config.scad>
use <bolt-drying-rack-plate.scad>
use <bolt-drying-rack-leg.scad>

// --- Exploded Assembly ---
explode = 10; // mm of extra spacing between parts for visibility

// Two legs at plate ends — centered on plate Y, feet splay beyond
for (i = [0, 1])
    translate([
        i * (plate_x - leg_post_x + explode * 2) - explode,
        -channel_wall + slot_tol,
        0
    ])
        leg();

// Bottom plate lowered
color("SteelBlue", 0.8)
    translate([0, 0, bottom_plate_z - explode])
        plate();

// Top plate raised
color("CornflowerBlue", 0.8)
    translate([0, 0, top_plate_z + explode])
        plate();

// --- Info echo ---
echo(str("Plate size: ", plate_x, " x ", plate_y, " x ", plate_thick, " mm"));
echo(str("Leg post: ", leg_post_x, " x ", leg_post_y, " x ", total_height, " mm"));
echo(str("Foot splay: ±", splay, " mm from center (", splay_angle, "° from vertical)"));
echo(str("Plate gap: ", plate_gap, " mm"));
echo(str("Compound exposure: ", compound_length, " mm"));
echo(str("Bolt tip clearance: ", clearance_mm, " mm"));
echo(str("Head margin on plate: ", (head_dia - hole_dia) / 2, " mm per side"));
echo(str("Print: 2x bolt-drying-rack-plate + 2x bolt-drying-rack-leg"));
