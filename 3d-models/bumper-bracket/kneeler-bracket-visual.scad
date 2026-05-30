// Assembly ghost — kneeler-bracket/kneeler-bracket.scad (steel reference).
// Keep kneeler_bracket_* in config.scad in sync. No top-level geometry here.

module _kneeler_bracket_visual_rounded_plate(l, w, t, r) {
    hull() {
        for (sx = [-1, 1], sy = [-1, 1])
            translate([sx * (l / 2 - r), sy * (w / 2 - r), 0])
                cylinder(h = t, r = r);
    }
}

module _kneeler_bracket_visual_csunk_hole(shank_d, csink_d, csink_depth, depth) {
    translate([0, 0, -1])
        cylinder(h = depth + 2, d = shank_d);
    translate([0, 0, depth - csink_depth])
        cylinder(h = csink_depth + 1, d1 = shank_d, d2 = csink_d);
}

module kneeler_bracket_visual_for_exploded_view() {
    near_x = -kneeler_bracket_plate_l_mm / 2 + kneeler_bracket_peg1_inset_mm;
    far_x = kneeler_bracket_plate_l_mm / 2 - kneeler_bracket_peg2_inset_mm;

    difference() {
        union() {
            _kneeler_bracket_visual_rounded_plate(
                kneeler_bracket_plate_l_mm,
                kneeler_bracket_plate_w_mm,
                kneeler_bracket_plate_thickness_mm,
                kneeler_bracket_corner_r_mm
            );
            for (px = [near_x, far_x])
                translate([px, 0, 0])
                    cylinder(h = kneeler_bracket_support_h_mm, d = kneeler_bracket_support_od_mm);
        }
        for (frac = kneeler_bracket_screw_x_frac) {
            sx = frac * kneeler_bracket_plate_l_mm - kneeler_bracket_plate_l_mm / 2;
            translate([sx, 0, 0])
                _kneeler_bracket_visual_csunk_hole(
                    kneeler_bracket_screw_d_mm,
                    kneeler_bracket_csink_d_mm,
                    kneeler_bracket_csink_depth_mm,
                    kneeler_bracket_plate_thickness_mm
                );
        }
    }

    translate([near_x, 0, kneeler_bracket_plate_thickness_mm])
        cylinder(h = kneeler_bracket_peg_h_mm, d = kneeler_bracket_peg_od_mm);
    translate([far_x, 0, kneeler_bracket_plate_thickness_mm])
        cylinder(h = kneeler_bracket_peg_h_mm, d = kneeler_bracket_peg_od_mm);
}

module kneeler_bracket_visual_mirrored_for_exploded_view() {
    if (kneeler_bracket_mirror_side)
        mirror([0, 1, 0])
            kneeler_bracket_visual_for_exploded_view();
    else
        kneeler_bracket_visual_for_exploded_view();
}
