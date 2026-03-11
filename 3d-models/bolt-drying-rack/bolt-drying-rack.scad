// --- TEKTONOLOGY BOLT DRYING RACK ASSEMBLY ---
// Two views controlled by the `view` variable:
//   "assembled"  — assembled rack with bolts shown in slots (default)
//   "overlap"    — assembled rack; only overlapping volumes are shown (red)
// Print parts from separate files:
//   bolt-drying-rack-plate.scad  (print 2)
//   bolt-drying-rack-leg.scad    (print 2)
include <bolt-drying-rack-config.scad>
use <bolt-drying-rack-plate.scad>
use <bolt-drying-rack-leg.scad>

// --- View selector ---
view = "assembled"; // "assembled" or "overlap"

// --- Bolt module: M3 socket head cap screw hanging head-down through top plate ---
module bolt() {
    $fn = 32;
    // Head (sits on top plate surface)
    cylinder(h = head_height, d = head_dia);
    // Shaft (extends downward from bottom of head)
    translate([0, 0, -bolt_length])
        cylinder(h = bolt_length, d = bolt_dia);
}

// --- All bolts in their hole positions ---
module all_bolts() {
    color("Silver", 0.9)
    for (r = [0 : rows - 1])
        for (c = [0 : cols - 1])
            translate([
                hole_x0 + c * spacing + (r % 2) * stagger,
                edge_margin + r * row_spacing,
                top_plate_z + plate_thick  // head sits on top of the top plate
            ])
                bolt();
}

// --- Assembled rack (plates + legs, no explode) ---
module rack_assembly() {
    // Two legs at plate ends
    for (i = [0, 1])
        translate([
            plate_thick + i * (plate_x - leg_post_x - plate_thick * 2),
            -channel_wall + tolerance,
            0
        ])
            leg();

    // Bottom plate — shifted up by tolerance to sit inside slot
    color("SteelBlue", 0.8)
        translate([0, 0, bottom_plate_z + tolerance])
            plate();

    // Top plate — shifted up by tolerance to sit inside slot
    color("CornflowerBlue", 0.8)
        translate([0, 0, top_plate_z + tolerance])
            plate();
}

// --- View: Assembled with bolts ---
module assembled_view() {
    rack_assembly();
    all_bolts();
}

// --- View: Overlap / interference highlight ---
// Shows only the volumes where two or more parts intersect.
module overlap_view() {
    // Ghost the full assembly for context
    color("White", 0.15)
        rack_assembly();

    // Build list of individual parts to check pairwise
    // Part A: left leg
    module left_leg() {
        translate([plate_thick, -channel_wall + tolerance, 0])
            leg();
    }
    // Part B: right leg
    module right_leg() {
        translate([plate_x - leg_post_x - plate_thick, -channel_wall + tolerance, 0])
            leg();
    }
    // Part C: bottom plate
    module bottom_plate() {
        translate([0, 0, bottom_plate_z])
            plate();
    }
    // Part D: top plate
    module top_plate() {
        translate([0, 0, top_plate_z])
            plate();
    }

    // Pairwise intersections — each pair gets a unique color for identification
    color("Red", 0.9)           // RED = left leg ∩ bottom plate
        intersection() { left_leg();    bottom_plate(); }
    color("Orange", 0.9)        // ORANGE = left leg ∩ top plate
        intersection() { left_leg();    top_plate();    }
    color("Yellow", 0.9)        // YELLOW = right leg ∩ bottom plate
        intersection() { right_leg();   bottom_plate(); }
    color("Magenta", 0.9)       // MAGENTA = right leg ∩ top plate
        intersection() { right_leg();   top_plate();    }
    color("Cyan", 0.9)          // CYAN = left leg ∩ right leg
        intersection() { left_leg();    right_leg();    }
    color("Lime", 0.9)          // LIME = bottom plate ∩ top plate
        intersection() { bottom_plate(); top_plate();   }
}

// --- Render selected view ---
if (view == "overlap") {
    overlap_view();
} else {
    assembled_view();
}

// --- Info echo ---
echo(str("Plate size: ", plate_x, " x ", plate_y, " x ", plate_thick, " mm"));
echo(str("Leg post: ", leg_post_x, " x ", leg_post_y, " x ", total_height, " mm"));
echo(str("Foot splay: ±", splay, " mm from center (", splay_angle, "° from vertical)"));
echo(str("Plate gap: ", plate_gap, " mm"));
echo(str("Compound exposure: ", compound_length, " mm"));
echo(str("Bolt tip clearance: ", clearance_mm, " mm"));
echo(str("Head margin on plate: ", (head_dia - hole_dia) / 2, " mm per side"));
echo(str("Print: 2x bolt-drying-rack-plate + 2x bolt-drying-rack-leg"));
