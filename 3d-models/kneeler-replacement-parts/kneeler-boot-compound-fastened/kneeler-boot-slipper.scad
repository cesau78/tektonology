// --- TEKTONOLOGY KNEELER BOOT — SLIPPER ---
// The slipper slides over the steel kneeler foot from one end.
// Its top lip extends over the cap on both long sides, creating an
// interlocking overlap. Hex nut pockets and bolt channels live in the
// side walls; hardware faces the wall so worshipers never see it.
include <kneeler-boot-config.scad>

// =====================================================================
// SLIPPER FASTENER GEOMETRY
// =====================================================================

// Hex nut pocket — centered at nut_x in the slipper body.
module hex_nut_pocket(z_pos, y_pos) {
    nut_r = (nut_af + nut_clearance) / 2 / cos(30);
    pocket_depth = nut_thickness + tolerance * 2;

    translate([nut_x - pocket_depth / 2, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=pocket_depth, r=nut_r, $fn=6);
}

<<<<<<< HEAD
// Hex nut slide-in slot — 45° toward center from nut pocket through shell.
// 30° flared entrance on X axis widens toward shell exit.
module hex_nut_slot(z_pos, y_pos) {
    slot_width = nut_af + nut_clearance;
    pocket_depth = nut_thickness + 0.2;
    slot_h = total_h;
    angle = (y_pos > 0) ? -45 : 45;

    // Full-length 30° taper on X: narrow at pocket, wide at exit
    flare_extra = slot_h * tan(30);

    translate([nut_x, y_pos, z_pos])
        rotate([angle, 0, 0])
            hull() {
                // Narrow end at nut pocket
                translate([-pocket_depth / 2, -slot_width / 2, 0])
                    cube([pocket_depth, slot_width, 0.01]);
                // Wide end at shell exit — 30° on each X side
                translate([-(pocket_depth / 2 + flare_extra), -slot_width / 2, -slot_h])
                    cube([pocket_depth + 2 * flare_extra, slot_width, 0.01]);
=======
// Hex nut slide-in slot — wedge cut, 60° toward center from nut pocket.
// Narrow at the nut pocket, widens toward the entry for easy insertion
// and angled walls that print cleanly with X-axis up.
// Only called with positive y_pos; mirror() handles the opposite side.
module hex_nut_slot(z_pos, y_pos) {
    slot_width = nut_af + nut_clearance;
    pocket_depth = nut_thickness + tolerance * 2;
    entry_depth = pocket_depth + 2 * slot_width * tan(60); // flared in X (print axis) for self-supporting walls
    slot_h = total_h; // generous length to exit the shell

    translate([nut_x, y_pos, z_pos])
        rotate([-44, 0, 0])
            hull() {
                // Narrow end at nut pocket
                translate([-pocket_depth / 2, -slot_width / 2, -0.01])
                    cube([pocket_depth, slot_width, 0.01]);
                // Wide end at entry — flared in X for printability
                translate([-entry_depth / 2, -slot_width / 2, -slot_h])
                    cube([entry_depth, slot_width, 0.01]);
>>>>>>> 425e971 (adjusted pockets for easier access and cleaning)
            }
}

// Bolt channel through the slipper — connects the split face to the nut pocket.
module bolt_channel(z_pos, y_pos) {
    hole_dia = bolt_dia + bolt_clearance;
    // From split face (+ 1mm overshoot) to past the nut pocket
    channel_start = nut_x - nut_thickness / 2 - 1;
    channel_length = split_x - channel_start + 1;

    translate([channel_start, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=channel_length, d=hole_dia);
}

// Matching cutouts in slipper side walls for the cap bosses
module cap_side_boss_holes() {
    boss_len = outer_extent - split_x;
    for (side = [1, -1])
        translate([split_x + boss_len / 2, side * cap_width / 2, bolt_z])
            rotate([0, 90, 0])
                cylinder(h=boss_len + 0.2, d=boss_dia + (boss_clearance * 2), center=true);
}


// =====================================================================
// SLIPPER PIECE
// =====================================================================

module slipper() {
    difference() {
        union() {
            // Slipper half of the shell
            intersection() {
                coupler_shell();
                slipper_half_space();
            }
            // Side walls extend full length over the cap zone
            intersection() {
                coupler_shell();
                cap_half_space();
                side_bands();
            }
            if (enable_top_lip) slipper_lip();
        }
        // Hex nut pockets, slide-in slots, and bolt channels
        // Define once for +Y side, mirror for −Y to guarantee symmetry
        for (m = [0, 1]) mirror([0, m, 0]) {
            hex_nut_pocket(bolt_z, cap_width / 2);
            hex_nut_slot(bolt_z, cap_width / 2);
            bolt_channel(bolt_z, cap_width / 2);
        }
        // Boss cutouts in slipper side walls
        cap_side_boss_holes();
        // Re-cut top socket through lip
        if (enable_top_lip) top_socket_cut();

        //offset entrance slide holes for the leg to slide into
        // translate([sole_plate_l / 2, 0, (total_h / 2) - (sole_plate_h / 2) + tolerance])
        //     minkowski() {
        //         cube([sole_plate_l / 2, leg_w, sole_plate_h], center=true);
        //         sphere(r=1.0);
        //     }
        // Relief cut so the cap lip nests flush into the slipper
        // Top of this cut aligns with the top of the coupler_shell
        relief_cut_z = (total_h / 2) - (lip_height / 2);
        // X span matches the +X lip ring: inner edge to outer edge (lip_r = 1.0 in top_lip)
        relief_inner_x = lip_inner_x / 2 + 1.0;
        relief_outer_x = (sole_plate_l + wall) / 2 + 1.0;
        relief_cut_x = (relief_inner_x + relief_outer_x) / 2 ;
        relief_cut_w = relief_outer_x - relief_inner_x;
        if (enable_top_lip) translate([relief_cut_x, 0, relief_cut_z])
            cube([relief_cut_w+2, cap_width, lip_height + tolerance], center=true);
    }
}

// =====================================================================
// RENDERING
// =====================================================================
//debug_nuts();

crosssection(sole_plate_l) slipper();
