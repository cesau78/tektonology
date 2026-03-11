include <notecard-holder-config.scad>
use <notecard-holder-bottom.scad>
use <notecard-holder-side.scad>
use <notecard-holder-divider.scad>
use <perforated-plate.scad>

bottom_width = width + 2 * (plate_thick + tolerance);
divider_width = width - 2 * plate_thick;

// 3"x5" notecard dimensions (landscape)
card_w = 127;    // 5 inches (across holder)
card_h = 76.2;   // 3 inches (height)
card_t = 0.5;    // thin for visualization
card_tilt = 15;   // degrees from vertical, leaning toward next divider

// --- Assembled view ---
module assembly() {
    // Bottom plate
    color("SteelBlue", 0.6) bottom();

    // Left side — rotated to stand upright in the left rail channel
    // Rotation maps: side X (width) → Y, side Y (height) → Z, side Z (plate_thick) → X
    color("Coral", 0.6)
        translate([plate_thick + tolerance, 0, plate_thick])
            rotate([0, 0, 90])
                rotate([90, 0, 0])
                    side();

    // Right side — mirrored into the right rail channel
    color("MediumSeaGreen", 0.6)
        translate([bottom_width, 0, 0])
            mirror([1, 0, 0])
                translate([plate_thick + tolerance, 0, plate_thick])
                    rotate([0, 0, 90])
                        rotate([90, 0, 0])
                            side();

    // Dividers — one in each rail pair slot, standing upright
    // Reduced by 2*plate_thick so they fit between the side plates
    gap_width = (width - plates * plate_thick - plate_thick * 2) / (plates) + plate_thick;
    for (i = [0 : plates - 1]) {
        divider_y = i * (plate_thick + gap_width) + plate_thick;
        color("Gold", 0.6)
            translate([2 * plate_thick + tolerance, divider_y + plate_thick, plate_thick])
                rotate([90, 0, 0])
                    perforated_plate(
                        p_length    = divider_width,
                        p_width     = height,
                        p_thickness = plate_thick,
                        p_hole_size = hole_dia,
                        p_spacing   = spacing,
                        p_length_margin = edge_margin,
                        p_width_margin  = edge_margin
                    );
    }

    // Simulated 3"x5" notecards — one per slot, tilted back
    for (i = [0 : plates - 2]) {
        slot_y = (i + 1) * (plate_thick + gap_width) + plate_thick - plate_thick;
        color("White", 0.7)
            translate([bottom_width / 2 - card_w / 2, slot_y, plate_thick])
                rotate([card_tilt, 0, 0])
                    cube([card_w, card_t, card_h]);
    }
}

// --- Overlap detection ---
// Shows any intersecting volume between bottom and sides in red
module overlaps() {
    bottom_part = 0;
    left_side_part = 1;
    right_side_part = 2;

    // Bottom ∩ Left side
    color("Red")
        intersection() {
            bottom();
            translate([plate_thick + tolerance, 0, plate_thick])
                rotate([0, 0, 90])
                    rotate([90, 0, 0])
                        side();
        }

    // Bottom ∩ Right side
    color("Red")
        intersection() {
            bottom();
            translate([bottom_width, 0, 0])
                mirror([1, 0, 0])
                    translate([plate_thick + tolerance, 0, plate_thick])
                        rotate([0, 0, 90])
                            rotate([90, 0, 0])
                                side();
        }
}

// Toggle: comment/uncomment to switch views
// 1) Assembly only — see how parts fit together
assembly();

// 2) Overlaps only — any red geometry = intersection (use F6 render for accuracy)
// overlaps();
