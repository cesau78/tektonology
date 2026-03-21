// PTFE Port — Shaft: flange + dual shaft with stop plates meeting in the middle
// Push shaft through tent, then slide collar on from the other side.
// Flange has slots for the collar's snap-fit clips.
include <ptfe-port-config.scad>

module ptfe_port_shaft() {
    shaft_height = gap + flange_thick; // extends through gap and flush with collar top
    total = flange_thick + shaft_height;

    // Slot positions must match collar clip positions (flush with shaft hole edge)
    shaft_w = body_w + collar_clearance * 2;
    shaft_h = body_h + collar_clearance * 2;
    hole_y_min = (flange_h - shaft_h) / 2;
    hole_y_max = (flange_h + shaft_h) / 2;
    clip_x = (flange_w - clip_width) / 2;

    // Slot dimensions — sized to clip tab only, barb catches on flange surface
    slot_w = clip_width + clip_clearance * 2;
    slot_d = clip_thick + clip_clearance * 2;

    body_offset = [(flange_w - body_w) / 2, (flange_h - body_h) / 2, 0];
    plate_z = flange_thick + shaft_height - stop_thick;

    union() {
        // Flange with clip slots
        difference() {
            rounded_rect(flange_w, flange_h, flange_thick, corner_r);

            // Tube channels through flange
            translate(body_offset)
                tube_holes(flange_thick);

            // Clip slots
            translate([clip_x - clip_clearance, -clip_clearance, -1])
                cube([slot_w, slot_d, flange_thick + 2]);
            translate([clip_x - clip_clearance, flange_h - clip_thick - clip_clearance, -1])
                cube([slot_w, slot_d, flange_thick + 2]);
        }

        // Primary shaft + stop plate
        translate([0, 0, flange_thick])
            shaft_body(shaft_height);

        // Mirrored shaft + stop plate — taller to match total bottom reach
        mirror_height = shaft_height + flange_thick;
        translate([0, 0, flange_thick + shaft_height + mirror_height])
            mirror([0, 0, 1])
                shaft_body(mirror_height);
    }
}

module shaft_body(height) {
    body_offset = [(flange_w - body_w) / 2, (flange_h - body_h) / 2, 0];
    plate_z = height - stop_thick;

    union() {
        // Shaft with tube channels
        difference() {
            translate(body_offset)
                rounded_rect(body_w, body_h, height, corner_r);

            translate(body_offset)
                tube_holes(height);
        }

        // Stop plate
        difference() {
            translate(body_offset + [0, 0, plate_z])
                rounded_rect(body_w, body_h, stop_thick, corner_r);

            // Chamfered filament holes
            chamfer_depth = stop_thick * 2;
            translate(body_offset + [0, 0, plate_z - stop_thick])
                for (c = [0 : cols - 1])
                    for (r = [0 : rows - 1])
                        translate([
                            wall + hole_dia / 2 + c * spacing,
                            wall + hole_dia / 2 + r * spacing,
                            -0.01
                        ])
                            cylinder(h = chamfer_depth + 0.02, d1 = hole_dia, d2 = filament_dia);
        }
    }
}

ptfe_port_shaft();
