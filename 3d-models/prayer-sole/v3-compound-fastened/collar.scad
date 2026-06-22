// --- TEKTONOLOGY PRAYER SOLE V3 — COLLAR ---
// The collar slides over the steel kneeler foot from one end.
// Its top lip overhangs on the entrance (-X) end and long sides there;
// the cap carries the +X-end lip overhangs. Hex nut pockets and bolt
// side walls; hardware faces the wall so worshipers never see it.
include <config.scad>

// =====================================================================
// COLLAR FASTENER GEOMETRY
// =====================================================================

// Hex nut pocket — centered at nut_x in the collar body.
module hex_nut_pocket(z_pos, y_pos) {
    nut_r = (nut_af + nut_clearance) / 2 / cos(30);
    pocket_depth = nut_thickness + tolerance;
    pocket_x_len = pocket_depth + (2 * nut_pocket_x_extra);

    translate([nut_x - pocket_x_len / 2, y_pos, z_pos])
        rotate([0, 90, 0])
            rotate([0, 0, 15]) // align hex flat with 45° slot entry
                cylinder(h=pocket_x_len, r=nut_r, $fn=6);
}

// Hex nut slide-in slot — 45° toward center from nut pocket through shell.
module hex_nut_slot(z_pos, y_pos) {
    slot_width = nut_af + nut_clearance;
    pocket_depth = nut_thickness + tolerance;
    // Slot length: pocket center to shell wall along the 45° path, +1mm overshoot
    shell_y = sole_plate_w / 2 + wall;
    slot_h = (shell_y - abs(y_pos)) / sin(45) + 1;
    angle = (y_pos > 0) ? -45 : 45;

    translate([nut_x, y_pos, z_pos])
        rotate([angle, 0, 0])
            translate([-pocket_depth / 2, -slot_width / 2, -slot_h])
                cube([pocket_depth, slot_width, slot_h]);
}

// Bolt channel through the collar — connects the split face to the nut pocket.
module bolt_channel(z_pos, y_pos) {
    hole_dia = bolt_dia + bolt_clearance;
    // Fixed X span from nut_x_derived; independent of nut_x_cap_offset
    translate([bolt_channel_start, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=bolt_channel_length, d=hole_dia);
}

// =====================================================================
// COLLAR PIECE
// =====================================================================

module collar() {
    difference() {
        union() {
            // Collar half of the shell
            intersection() {
                coupler_shell();
                collar_half_space();
            }
            if (enable_top_lip) collar_lip();
        }
        // Hex nut pockets, slide-in slots, and bolt channels
        // Define once for +Y side, mirror for −Y to guarantee symmetry
        for (m = [0, 1]) mirror([0, m, 0]) {
            hex_nut_pocket(bolt_z, cap_width / 2);
            hex_nut_slot(bolt_z, cap_width / 2);
            bolt_channel(bolt_z, cap_width / 2);
        }
        guide_pin_holes();
        // Re-cut top socket through lip
        if (enable_top_lip) top_socket_cut();

        //offset entrance slide holes for the leg to slide into
        // translate([sole_plate_l / 2, 0, (total_h / 2) - (sole_plate_h / 2) + tolerance])
        //     minkowski() {
        //         cube([sole_plate_l / 2, leg_w, sole_plate_h], center=true);
        //         sphere(r=1.0);
        //     }
        // Relief cut so the cap lip nests flush into the collar
        // Top of this cut aligns with the top of the coupler_shell
        relief_cut_z = (total_h / 2) - (lip_height / 2);
        // X span matches the +X lip ring: inner edge to outer edge (lip_r = 1.0 in top_lip)
        relief_inner_x = lip_inner_x / 2 + 1.0;
        relief_outer_x = (sole_plate_l + wall) / 2 + 1.0;
        relief_cut_x = (relief_inner_x + relief_outer_x) / 2 ;
        relief_cut_w = relief_outer_x - relief_inner_x;
        if (enable_top_lip) translate([relief_cut_x, 0, relief_cut_z])
            cube([relief_cut_w+2, sole_plate_w + (wall * 2)  , lip_height + tolerance], center=true);
    }
}

// =====================================================================
// RENDERING
// =====================================================================
//debug_nuts();

crosssection(sole_plate_l) collar();
