// --- TEKTONOLOGY PRAYER SOLE V3 — CAP ---
// The cap bolts onto the hidden end of the kneeler foot to lock the collar
// in place. Two M3 socket-head cap screws thread through side bosses into
// hex nut pockets in the collar. The cap lip fills the far short-end gap
// between the collar's overhanging lips.
include <config.scad>

// =====================================================================
// CAP FASTENER GEOMETRY
// =====================================================================

head_pocket_diameter = head_dia + head_clearance + tolerance;

// Shaft through-hole (full span along +X).
module bolt_shaft_hole(z_pos, y_pos) {
    hole_dia = bolt_dia + bolt_clearance;
    translate([split_x - 1, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=outer_extent - split_x + 2, d=hole_dia);
}

// Socket-head pocket only (+X from outer face inward).
module bolt_head_pocket_hole(z_pos, y_pos) {
    translate([outer_extent - head_height + tolerance, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=head_height + 1, d=head_pocket_diameter);
}

// Bolt through-hole + socket head recess in the cap piece.
module bolt_hole(z_pos, y_pos) {
    bolt_shaft_hole(z_pos, y_pos);
    bolt_head_pocket_hole(z_pos, y_pos);
}

// Cap side bosses — half-cylinders on each Y edge of the cap
module cap_side_bosses() {
    boss_len = outer_extent - split_x; // full cap depth along X
    for (side = [1, -1])
        translate([split_x + boss_len / 2 - tolerance, side * cap_width / 2, bolt_z])
            rotate([0, 90, 0])
                cylinder(h=boss_len, d=boss_dia, center=true);
}

// Support pillars for boss edges — designed for X-down printing.  Straight
// tapered pillars run from the bed face (+X) to the boss/pocket ceiling,
// positioned on the outer boss circumference and connected at the base for
// bed adhesion.  Thin tips at the boss face snap off cleanly.
// Placed in the outer union so tips survive the screw-head pocket cut.
module cap_boss_support_trees() {
    if (boss_print_support_enable && boss_support_boss_flank_enable) {
        r = boss_dia / 2;
        x_bed = outer_extent;
        x_ceiling = outer_extent - head_height + tolerance;

        intersection() {
            difference() {
                union() {
                    for (side = [1, -1]) {
                        y_boss = side * cap_width / 2;

                        // Tapered pillars from bed face to boss/pocket ceiling
                        for (a = tree_branch_angles) {
                            tip_y = y_boss + side * cos(a) * (r - 0.15);
                            tip_z = bolt_z + sin(a) * (r - 0.15);
                            hull() {
                                translate([x_bed, tip_y, tip_z])
                                    cube([0.01, tree_base_width, tree_base_width], center=true);
                                translate([x_ceiling + 0.05, tip_y, tip_z])
                                    cube([tree_branch_tip, tree_branch_tip, tree_branch_tip], center=true);
                            }
                        }

                        // Bridges linking adjacent pillar bases on the bed face
                        for (i = [0 : len(tree_branch_angles) - 2]) {
                            a1 = tree_branch_angles[i];
                            a2 = tree_branch_angles[i + 1];
                            y1 = y_boss + side * cos(a1) * (r - 0.15);
                            z1 = bolt_z + sin(a1) * (r - 0.15);
                            y2 = y_boss + side * cos(a2) * (r - 0.15);
                            z2 = bolt_z + sin(a2) * (r - 0.15);
                            hull() {
                                translate([x_bed - 0.15, y1, z1])
                                    cube([0.3, tree_base_width * 0.4, tree_base_width * 0.4], center=true);
                                translate([x_bed - 0.15, y2, z2])
                                    cube([0.3, tree_base_width * 0.4, tree_base_width * 0.4], center=true);
                            }
                        }

                        // Inward-facing brims at the bed face for adhesion,
                        // hulled pairwise so adjacent brims merge seamlessly
                        for (i = [0 : len(tree_branch_angles) - 1]) {
                            a1 = tree_branch_angles[i];
                            y1 = y_boss + side * cos(a1) * (r - 0.15);
                            z1 = bolt_z + sin(a1) * (r - 0.15);
                            if (i < len(tree_branch_angles) - 1) {
                                a2 = tree_branch_angles[i + 1];
                                y2 = y_boss + side * cos(a2) * (r - 0.15);
                                z2 = bolt_z + sin(a2) * (r - 0.15);
                                hull() {
                                    translate([x_bed, y1, z1])
                                        cube([tree_brim_thickness, tree_base_width, tree_base_width], center=true);
                                    translate([x_bed, y1 - side * tree_brim_width, z1])
                                        cube([tree_brim_thickness, tree_base_width * 0.5, tree_base_width], center=true);
                                    translate([x_bed, y2, z2])
                                        cube([tree_brim_thickness, tree_base_width, tree_base_width], center=true);
                                    translate([x_bed, y2 - side * tree_brim_width, z2])
                                        cube([tree_brim_thickness, tree_base_width * 0.5, tree_base_width], center=true);
                                }
                            } else {
                                hull() {
                                    translate([x_bed, y1, z1])
                                        cube([tree_brim_thickness, tree_base_width, tree_base_width], center=true);
                                    translate([x_bed, y1 - side * tree_brim_width, z1])
                                        cube([tree_brim_thickness, tree_base_width * 0.5, tree_base_width], center=true);
                                }
                            }
                        }
                    }
                }
                for (pos = bolt_positions)
                    bolt_shaft_hole(pos[0], pos[1]);
            }
            translate([-big, -big, -big])
                cube([big + outer_extent, big * 2, big * 2]);
        }
    }
}

// =====================================================================
// ALIGNMENT FEATURES
// =====================================================================

module alignment_groove() {
    tw = tongue_width + (tongue_clearance * 2);
    th = tongue_height + (tongue_clearance * 2);
    td = tongue_depth + tongue_clearance;

    translate([split_x - tolerance, -tw / 2, -th / 2])
        cube([td + tolerance, tw, th]);
}

// Complementary lip piece — fills the entrance slide cut from the collar
module entrance_lip_fill() {
    intersection() {
        collar_lip();
        translate([sole_plate_l / 2, 0, (total_h / 2) - (sole_plate_h / 2) + tolerance])
            minkowski() {
                cube([sole_plate_l / 2, leg_w, sole_plate_h], center=true);
                sphere(r=1.0);
            }
        // Clip to cap's X bounds so nothing extends beyond the shell
        translate([split_x * 1.2, -big, -big])
            cube([outer_extent - split_x, big * 2, big * 2]);
    }
}

// =====================================================================
// CAP PIECE
// =====================================================================

module cap() {
    union() {
        difference() {
            union() {
                // Cap width matches the bottom groove (wider than collar center band)
                intersection() {
                    coupler_shell();
                    cap_half_space();
                    translate([-big, -(cap_width / 2) + tolerance, -big])
                        cube([big * 2, cap_width - (tolerance * 2), big * 2]);
                }
                if (enable_top_lip) cap_lip();
                // Lip piece that was cut from collar entrance
                //if (enable_top_lip) entrance_lip_fill();
                // Fill socket from lip bottom to shell top so groove starts at lip level
                intersection() {
                    translate([0, 0, (total_h / 2) - 0.5])
                        cube([sole_plate_l, sole_plate_w, 1.0], center=true);
                    cap_half_space();
                }
                // Side bosses — half-cylinders at cap Y edges
                cap_side_bosses();
            }
            for (pos = bolt_positions)
                bolt_hole(pos[0], pos[1]);
            // Re-cut top socket through lip
            if (enable_top_lip) top_socket_cut();
            //alignment_groove();
        }
        cap_boss_support_trees();
    }
}

// =====================================================================
// RENDERING
// =====================================================================
//debug_nuts();

crosssection(sole_plate_l) cap();
