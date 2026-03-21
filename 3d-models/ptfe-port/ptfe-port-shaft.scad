// PTFE Port — Shaft: flange + shaft
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

    // Slot dimensions (only as deep as the clip tab, not the barb)
    slot_w = clip_width + clip_clearance * 2;
    slot_d = clip_thick + clip_clearance * 2;

    difference() {
        union() {
            // Flange (sits against inside of tent)
            rounded_rect(flange_w, flange_h, flange_thick, corner_r);

            // Shaft (passes through tent fabric and flush with collar top)
            translate([(flange_w - body_w) / 2, (flange_h - body_h) / 2, flange_thick])
                rounded_rect(body_w, body_h, shaft_height, corner_r);
        }

        // Tube channels
        translate([(flange_w - body_w) / 2, (flange_h - body_h) / 2, 0])
            tube_holes(total);

        // Clip slots through the flange — flush with outer edge, sized for clip tab only
        // Front slot
        translate([clip_x - clip_clearance, -clip_clearance, -1])
            cube([slot_w, slot_d, flange_thick + 2]);

        // Back slot
        translate([clip_x - clip_clearance, flange_h - clip_thick - clip_clearance, -1])
            cube([slot_w, slot_d, flange_thick + 2]);
    }
}

ptfe_port_shaft();
