// --- TEKTONOLOGY FASTENED KNEELER BOOT — BOLT DRYING RACK LEG ---
// Inverted Y leg: upper post with plate channels, splits into two
// angled branches halfway down for stability.
// Print 2 per rack. Printed on its side — use brim in slicer for
// bed adhesion on the thin angled branches.
include <bolt-drying-rack-config.scad>

module channel_slot(z_base) {
    translate([-0.1, channel_wall - slot_tol, z_base - slot_tol])
        cube([leg_post_x + 0.2, slot_y, slot_h]);
}

// Ceiling-only detent: plate rests on slot floor with full clearance,
// ceiling detent presses down to retain. Running clearance = slot_tol * 2.
module snap_detent(z_base) {
    translate([leg_post_x / 2 - detent_w / 2, channel_wall - slot_tol, z_base + slot_h - 0.01 + slot_tol])
        hull() {
            cube([detent_w, slot_y, 0.01]);
            translate([0, 0, -detent_h])
                cube([0.01, slot_y, 0.01]);
        }
}

module post_section_at(z) {
    translate([0, 0, z])
        cube([leg_post_x, leg_post_y, 0.01]);
}

module foot_pad(y_offset) {
    translate([0, leg_post_y / 2 - foot_d / 2 + y_offset, 0])
        cube([foot_w, foot_d, 0.01]);
}

// Lightening holes through one Y-branch face (oriented along X), 3 rows across Y
module branch_holes(y_splay) {
    margin   = hole_dia * 0.75;
    step     = hole_dia * 1.5;
    n_holes  = floor((split_z - 2 * margin) / step);
    n_rows   = 3;
    row_step = step;   // Y spacing between rows
    for (r = [0 : n_rows - 1]) {
        y_off    = (r - (n_rows - 1) / 2) * row_step;
        // Inner row faces the other branch (opposite sign to y_splay)
        is_inner = (y_off * y_splay < 0) ? true : false;
        for (i = [0 : n_holes - 1]) {
            // Skip topmost inner-row hole — placed once in leg() instead
            if (!(is_inner && i == n_holes - 1))
            {
                z    = margin + step * i + step / 2;
                frac = z / split_z;
                y_c  = leg_post_y / 2 + y_splay * (1 - frac) + y_off;
                translate([leg_post_x / 2, y_c, z])
                    rotate([0, 90, 0])
                        cylinder(h = leg_post_x + 1, d = hole_dia, center = true, $fn = 24);
            }
        }
    }
}

// Lightening holes in a Z range of the straight upper post
module post_holes_in_range(z_lo, z_hi) {
    margin   = hole_dia * 0.75;
    step     = hole_dia * 1.5;
    span     = z_hi - z_lo;
    n_holes  = floor((span - 2 * margin) / step);
    for (i = [0 : n_holes - 1]) {
        z = z_lo + margin + step * i + step / 2;
        translate([leg_post_x / 2, leg_post_y / 2, z])
            rotate([0, 90, 0])
                cylinder(h = leg_post_x + 1, d = hole_dia, center = true, $fn = 24);
    }
}

// Grid of lightening holes: n_z rows along Z, 3 across Y, configurable Y gap
module hole_grid(z_lo, z_hi, n_z, y_gap = hole_dia * 1.5) {
    n_y      = 3;
    span     = z_hi - z_lo;
    z_step   = span / (n_z + 1);
    for (r = [0 : n_y - 1]) {
        y_off = (r - (n_y - 1) / 2) * y_gap;
        for (i = [1 : n_z]) {
            z = z_lo + z_step * i;
            translate([leg_post_x / 2, leg_post_y / 2 + y_off, z])
                rotate([0, 90, 0])
                    cylinder(h = leg_post_x + 1, d = hole_dia, center = true, $fn = 24);
        }
    }
}

module post_holes() {
    slot_bottom_lo = bottom_plate_z - slot_tol;
    slot_bottom_hi = bottom_plate_z + slot_h + slot_tol;
    slot_top_lo    = top_plate_z - slot_tol;
    slot_top_hi    = top_plate_z + slot_h + slot_tol;

    // 3x3 below the bottom slot
    hole_grid(split_z - 8, slot_bottom_lo + 2, 2);
    // 2x3 between the two slots, 3mm between Z rows
    z_gap_top = hole_dia + 3;
    n_z_top   = 2;
    z_span    = z_gap_top * (n_z_top - 0.5);
    z_mid     = (slot_bottom_hi + slot_top_lo) / 2;
    hole_grid(z_mid - z_span / 2 - hole_dia / 2, z_mid + z_span / 2 + hole_dia / 2, n_z_top);
}

module leg() {
    difference() {
        union() {
            // Upper post with channels
            difference() {
                translate([0, 0, split_z])
                    cube([leg_post_x, leg_post_y, total_height - split_z]);
                channel_slot(bottom_plate_z);
                channel_slot(top_plate_z);
            }
            snap_detent(bottom_plate_z);
            snap_detent(top_plate_z);

            // Lower Y-branches
            hull() {
                post_section_at(split_z);
                foot_pad(-splay);
            }
            hull() {
                post_section_at(split_z);
                foot_pad(splay);
            }
        }
        // Lightening holes in branches and upper post
        branch_holes(-splay);
        branch_holes(splay);
        // Single shared hole where the two center rows meet at the top
        _bm = hole_dia * 0.75;
        _bs = hole_dia * 1.5;
        _bn = floor((split_z - 2 * _bm) / _bs);
        _tz = _bm + _bs * (_bn - 1) + _bs / 2;
        translate([leg_post_x / 2, leg_post_y / 2, _tz])
            rotate([0, 90, 0])
                cylinder(h = leg_post_x + 1, d = hole_dia, center = true, $fn = 24);
        post_holes();
    }
}

// Lay on side for printing
translate([0, 0, leg_post_x])
    rotate([-90, 0, 90])
        leg();
