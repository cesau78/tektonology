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
        translate([split_x + boss_len / 2, side * cap_width / 2, bolt_z])
            rotate([0, 90, 0])
                cylinder(h=boss_len, d=boss_dia, center=true);
}

// Support pillars for boss — X-down printing. Tapered pillars from the bed
// face (+X) to the pocket ceiling on several radii of the curved face (not
// only the outer rim).  Thin tips snap off cleanly.
// Placed in the outer union so tips survive the screw-head pocket cut.
module cap_boss_support_trees() {
    if (boss_print_support_enable && boss_support_boss_flank_enable) {
        r = boss_dia / 2;
        x_bed = outer_extent;
        x_ceiling = outer_extent - head_height + tolerance;
        // Asymmetric brim: fixed small +X lip, bulk of X extent goes −X (inward along print axis).
        brim_x_len = tree_brim_inward + tree_brim_outward_lip;
        brim_x_c = x_bed + (tree_brim_outward_lip - tree_brim_inward) / 2;
        bridge_x_c = x_bed - tree_bridge_x / 2;

        intersection() {
            difference() {
                union() {
                    for (side = [1, -1]) {
                        y_boss = side * cap_width / 2;
                        rim_r = r - 0.15;

                        for (rf = tree_support_radius_fracs) {
                            rad = rim_r * rf;
                            tip = (rf >= 0.999) ? tree_branch_tip : tree_branch_tip * tree_inner_tip_scale;
                            base_w = (rf >= 0.999) ? tree_base_width : tree_base_width * 0.92;

                            // Tapered pillars from bed face to boss/pocket ceiling
                            for (a = tree_branch_angles) {
                                tip_y = y_boss + side * cos(a) * rad;
                                tip_z = bolt_z + sin(a) * rad;
                                hull() {
                                    translate([x_bed, tip_y, tip_z])
                                        cube([0.01, base_w, base_w], center=true);
                                    translate([x_ceiling + 0.05, tip_y, tip_z])
                                        cube([tip, tip, tip], center=true);
                                }
                            }

                            // Bridges linking adjacent pillar bases on the bed face
                            for (i = [0 : len(tree_branch_angles) - 2]) {
                                a1 = tree_branch_angles[i];
                                a2 = tree_branch_angles[i + 1];
                                y1 = y_boss + side * cos(a1) * rad;
                                z1 = bolt_z + sin(a1) * rad;
                                y2 = y_boss + side * cos(a2) * rad;
                                z2 = bolt_z + sin(a2) * rad;
                                hull() {
                                    translate([bridge_x_c, y1, z1])
                                        cube([tree_bridge_x, base_w * 0.55, base_w * 0.55], center=true);
                                    translate([bridge_x_c, y2, z2])
                                        cube([tree_bridge_x, base_w * 0.55, base_w * 0.55], center=true);
                                }
                            }
                        }

                        // Inward-facing brims at the bed face for adhesion (outer rim only),
                        // hulled pairwise so adjacent brims merge seamlessly
                        for (i = [0 : len(tree_branch_angles) - 1]) {
                            a1 = tree_branch_angles[i];
                            y1 = y_boss + side * cos(a1) * rim_r;
                            z1 = bolt_z + sin(a1) * rim_r;
                            if (i < len(tree_branch_angles) - 1) {
                                a2 = tree_branch_angles[i + 1];
                                y2 = y_boss + side * cos(a2) * rim_r;
                                z2 = bolt_z + sin(a2) * rim_r;
                                hull() {
                                    translate([brim_x_c, y1, z1])
                                        cube([brim_x_len, tree_base_width, tree_base_width], center=true);
                                    translate([brim_x_c, y1 - side * tree_brim_width, z1])
                                        cube([brim_x_len, tree_base_width * 0.55, tree_base_width * 0.55], center=true);
                                    translate([brim_x_c, y2, z2])
                                        cube([brim_x_len, tree_base_width, tree_base_width], center=true);
                                    translate([brim_x_c, y2 - side * tree_brim_width, z2])
                                        cube([brim_x_len, tree_base_width * 0.55, tree_base_width * 0.55], center=true);
                                }
                            } else {
                                hull() {
                                    translate([brim_x_c, y1, z1])
                                        cube([brim_x_len, tree_base_width, tree_base_width], center=true);
                                    translate([brim_x_c, y1 - side * tree_brim_width, z1])
                                        cube([brim_x_len, tree_base_width * 0.55, tree_base_width * 0.55], center=true);
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
                    translate([-big, -(cap_width / 2), -big])
                        cube([big * 2, cap_width, big * 2]);
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
                // Side-wall strips beyond each boss (moved from collar)
                cap_zone_side_walls();
                // Side bosses — half-cylinders at cap Y edges
                cap_side_bosses();
            }
            for (pos = bolt_positions)
                bolt_hole(pos[0], pos[1]);
            // Re-cut top socket through lip
            if (enable_top_lip) top_socket_cut();
            //alignment_groove();
        }
        //cap_boss_support_trees();
    }
}

// =====================================================================
// RENDERING
// =====================================================================
//debug_nuts();

crosssection(sole_plate_l) cap();
