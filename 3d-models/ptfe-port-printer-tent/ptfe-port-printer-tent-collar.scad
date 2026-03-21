// PTFE Port — Collar: wraps the shaft and clamps against tent fabric
// Includes snap-fit clips that lock through slots in the shaft flange.
include <ptfe-port-printer-tent-config.scad>

module ptfe_port_collar() {
    shaft_w = body_w + collar_clearance * 2;
    shaft_h = body_h + collar_clearance * 2;
    hole_x = (collar_w - shaft_w) / 2;
    hole_y_min = (collar_h - shaft_h) / 2;
    hole_y_max = (collar_h + shaft_h) / 2;

    clip_x = (collar_w - clip_width) / 2;

    union() {
        difference() {
            // Outer body — scaled collar diameter
            rounded_rect(collar_w, collar_h, flange_thick, corner_r);

            // Hole sized to the shaft (body + clearance)
            translate([hole_x, hole_y_min, -1])
                rounded_rect(shaft_w, shaft_h, flange_thick + 2, corner_r);
        }

        // Front clip — tab in collar material, flush with inner edge, barb faces inward (+Y)
        translate([clip_x, hole_y_min - clip_thick, flange_thick])
            snap_clip();

        // Back clip — tab in collar material, flush with inner edge, barb faces inward (-Y)
        translate([clip_x, hole_y_max + clip_thick, flange_thick])
            mirror([0, 1, 0])
                snap_clip();
    }
}

module snap_clip() {
    // Tab: thin flexible arm
    cube([clip_width, clip_thick, clip_reach]);

    // Barb — triangular prism: ramps from flush at top to full lip_depth at bottom
    // so the clip slides past the flange on insertion, then catches on removal
    translate([0, clip_thick, clip_reach - lip_height])
        rotate([90, 0, 90])
            linear_extrude(height = clip_width)
                polygon([
                    [0, 0],            // top of barb, flush with tab
                    [lip_depth, 0],    // top of barb, full protrusion
                    [0, lip_height]    // bottom catch edge, flush with tab
                ]);
}

ptfe_port_collar();
