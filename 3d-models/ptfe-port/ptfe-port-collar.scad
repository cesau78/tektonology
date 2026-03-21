// PTFE Port — Collar: wraps the shaft and clamps against tent fabric
// Includes snap-fit clips that lock through slots in the shaft flange.
include <ptfe-port-config.scad>

module ptfe_port_collar() {
    shaft_w = body_w + collar_clearance * 2;
    shaft_h = body_h + collar_clearance * 2;
    hole_y_min = (flange_h - shaft_h) / 2;
    hole_y_max = (flange_h + shaft_h) / 2;

    clip_x = (flange_w - clip_width) / 2;

    union() {
        difference() {
            // Outer body — matches flange outer diameter
            rounded_rect(flange_w, flange_h, flange_thick, corner_r);

            // Hole sized to the shaft (body + clearance)
            translate([(flange_w - shaft_w) / 2, hole_y_min, -1])
                rounded_rect(shaft_w, shaft_h, flange_thick + 2, corner_r);
        }

        // Front clip — flush with outer edge (y=0), barb faces inward (+Y)
        translate([clip_x, 0, flange_thick])
            snap_clip();

        // Back clip — flush with outer edge (y=flange_h), barb faces inward (-Y)
        translate([clip_x, flange_h, flange_thick])
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
