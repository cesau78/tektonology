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

module leg() {
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
}

// Lay on side for printing
translate([0, 0, leg_post_x])
    rotate([-90, 0, 90])
        leg();
