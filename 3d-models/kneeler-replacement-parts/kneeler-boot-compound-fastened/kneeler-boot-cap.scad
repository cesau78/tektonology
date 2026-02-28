// --- TEKTONOLOGY KNEELER BOOT — CAP ---
// The cap bolts onto the hidden end of the kneeler foot to lock the slipper
// in place. Two M3 socket-head cap screws thread through side bosses into
// hex nut pockets in the slipper. The cap lip fills the far short-end gap
// between the slipper's overhanging lips.
include <kneeler-boot-config.scad>

// =====================================================================
// CAP FASTENER GEOMETRY
// =====================================================================

// Bolt through-hole + socket head recess in the cap piece.
module bolt_hole(z_pos, y_pos) {
    hole_dia = bolt_dia + bolt_clearance;
    head_pocket_dia = head_dia + head_clearance;

    // Shaft hole through the full cap
    translate([split_x - 1, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=outer_extent - split_x + 2, d=hole_dia);

    // Socket head recess on the outer face (+X end)
    translate([outer_extent - head_height + 0.1, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=head_height + 1, d=head_pocket_dia);
}

// Cap side bosses — half-cylinders on each Y edge of the cap
module cap_side_bosses() {
    boss_len = outer_extent - split_x; // full cap depth along X
    for (side = [1, -1])
        translate([split_x + boss_len / 2, side * cap_width / 2, bolt_z])
            rotate([0, 90, 0])
                cylinder(h=boss_len, d=boss_dia, center=true);
}

// =====================================================================
// ALIGNMENT FEATURES
// =====================================================================

module alignment_groove() {
    tw = tongue_width + (tongue_clearance * 2);
    th = tongue_height + (tongue_clearance * 2);
    td = tongue_depth + tongue_clearance;

    translate([split_x - 0.1, -tw / 2, -th / 2])
        cube([td + 0.1, tw, th]);
}

// =====================================================================
// CAP PIECE
// =====================================================================

module cap() {
    difference() {
        union() {
            // Cap width matches the bottom groove (wider than slipper center band)
            intersection() {
                coupler_shell();
                cap_half_space();
                translate([-big, -cap_width / 2, -big])
                    cube([big * 2, cap_width, big * 2]);
            }
            if (enable_top_lip) cap_lip();
            // Side bosses — half-cylinders at cap Y edges
            cap_side_bosses();
        }
        for (pos = bolt_positions)
            bolt_hole(pos[0], pos[1]);
        // Re-cut top socket through lip
        if (enable_top_lip) top_socket_cut();
        //alignment_groove();
    }
}

// =====================================================================
// RENDERING
// =====================================================================
//debug_nuts();

crosssection(leg_l) cap();
