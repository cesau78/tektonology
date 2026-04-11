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

// Thin ribs inside the screw head pocket (same cylinder as bolt_head_pocket_hole), along +X
// from the inner pocket toward the outer opening — snap off after print. Unioned after the
// main difference() so they are not removed by the head-pocket cut; shaft hole is re-cut.
module cap_socket_head_pocket_supports() {
    if (boss_print_support_enable && boss_support_socket_pocket_enable && boss_support_socket_count >= 1) {
        x_ps = outer_extent - head_height + tolerance;
        pocket_len = head_height + 1;
        x_pe = x_ps + pocket_len;
        head_r = head_pocket_diameter / 2;
        difference() {
            union() {
                for (pos = bolt_positions) {
                    z_p = pos[0];
                    y_p = pos[1];
                    for (k = [0 : boss_support_socket_count - 1]) {
                        a = 90 + k * 120;
                        dy = cos(a) * (head_r - 0.42);
                        dz = sin(a) * (head_r - 0.42);
                        intersection() {
                            hull() {
                                translate([x_ps + 0.55, y_p + dy * 0.22, z_p + dz * 0.22])
                                    cube([0.65, 0.48, 0.48], center=true);
                                translate([x_pe - 0.5, y_p + dy, z_p + dz])
                                    cube([0.65, boss_support_socket_tip, boss_support_socket_tip], center=true);
                            }
                            translate([x_ps, y_p, z_p])
                                rotate([0, 90, 0])
                                    cylinder(h=pocket_len + 0.02, d=head_pocket_diameter - 0.08);
                        }
                    }
                }
            }
            for (pos = bolt_positions)
                bolt_shaft_hole(pos[0], pos[1]);
        }
    }
}


// Optional side-boss flank supports — see boss_support_stack_axis in config.scad.
module cap_boss_support_fins() {
    if (boss_print_support_enable && boss_support_boss_flank_enable && boss_support_count >= 1) {
        boss_len = outer_extent - split_x;
        r = boss_dia / 2;
        hole_r = (bolt_dia + bolt_clearance) / 2;
        y_fin_mag = cap_width / 2 + max(boss_support_y_offset, hole_r + 0.45);
        if (boss_support_y_offset >= r - 0.05) {
            echo("WARNING: boss_support_y_offset must be < boss_dia/2 for boss print supports.");
        } else {
            dz_arc = sqrt(r * r - (y_fin_mag - cap_width / 2) * (y_fin_mag - cap_width / 2));
            z_attach = bolt_z - dz_arc + 0.5;
            z_floor = bolt_z - r - 1.15;
            span = max(boss_len - 6, 0.5);
            // Inward Y end: inside shell, outside boss cylinder in Y
            y_in_mag = cap_width / 2 - r - 0.55;
            z_band = 0.52;
            z_low_c = z_floor + z_band / 2 + 0.08;
            z_hi_c = min(bolt_z + hole_r + 0.85, bolt_z + r - 0.15);

            for (side = [1, -1]) {
                y_fin = side * y_fin_mag;
                y_in = side * y_in_mag;
                for (i = [0 : boss_support_count - 1]) {
                    t = (boss_support_count <= 1) ? 0.5 : i / (boss_support_count - 1);
                    xi = split_x + 3 + t * span;

                    if (boss_support_stack_axis == "z") {
                        hull() {
                            translate([xi, y_fin, z_floor + 0.35])
                                cube([boss_support_thickness, 0.72, 0.7], center=true);
                            translate([xi, y_fin, z_attach])
                                cube([boss_support_thickness, boss_support_tip, boss_support_tip], center=true);
                        }
                    } else if (boss_support_stack_axis == "y") {
                        // Low-Z band: clears M3 shaft in YZ
                        hull() {
                            translate([xi, y_fin, z_low_c])
                                cube([boss_support_thickness, boss_support_tip, z_band], center=true);
                            translate([xi, y_in, z_low_c])
                                cube([boss_support_thickness, 0.72, z_band], center=true);
                        }
                        // High-Z band
                        hull() {
                            translate([xi, y_fin, z_hi_c])
                                cube([boss_support_thickness, boss_support_tip, z_band], center=true);
                            translate([xi, y_in, z_hi_c])
                                cube([boss_support_thickness, 0.72, z_band], center=true);
                        }
                    } else if (boss_support_stack_axis == "x") {
                        // Along boss axis: tie shell (+X) to outer flank; ends before socket-head pocket.
                        x_in = split_x + 1.2;
                        x_out = outer_extent - head_height - 1.8;
                        z_sp = 0.5;
                        tz = (boss_support_count <= 1) ? 0.5 : i / (boss_support_count - 1);
                        zk = z_low_c + tz * (z_hi_c - z_low_c);
                        translate([(x_in + x_out) / 2, y_fin, zk])
                            cube([x_out - x_in, 0.55, z_sp], center=true);
                    } else if (boss_support_stack_axis == "notch") {
                        // Crevice under boss then up outer Y — only if that crevice faces the bed.
                        hull() {
                            translate([xi, y_in, z_floor + 0.35])
                                cube([boss_support_thickness, 0.72, 0.65], center=true);
                            translate([xi, y_fin, z_low_c])
                                cube([boss_support_thickness, boss_support_tip, z_band], center=true);
                        }
                        hull() {
                            translate([xi, y_fin, z_low_c])
                                cube([boss_support_thickness, boss_support_tip, z_band], center=true);
                            translate([xi, y_fin, z_attach])
                                cube([boss_support_thickness, boss_support_tip, boss_support_tip], center=true);
                        }
                    } else {
                        echo("WARNING: boss_support_stack_axis must be \"x\", \"z\", \"y\", or \"notch\".");
                    }
                }
            }
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
                cap_boss_support_fins();
            }
            for (pos = bolt_positions)
                bolt_hole(pos[0], pos[1]);
            // Re-cut top socket through lip
            if (enable_top_lip) top_socket_cut();
            //alignment_groove();
        }
        cap_socket_head_pocket_supports();
    }
}

// =====================================================================
// RENDERING
// =====================================================================
//debug_nuts();

crosssection(sole_plate_l) cap();
