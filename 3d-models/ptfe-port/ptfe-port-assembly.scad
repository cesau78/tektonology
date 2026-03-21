// PTFE Port — Assembly View
include <ptfe-port-config.scad>

// Cross-section settings
crosssection_view = true;
crosssection_axis = "x";  // "x", "y", or "z"
crosssection_pos  = 0;    // mm offset from center of model along chosen axis

// Exploded view — set > 0 to separate parts for inspection
explode = 0;

use <ptfe-port-shaft.scad>
use <ptfe-port-collar.scad>

module ptfe_port_assembly() {
    // Port: flange + shaft
    ptfe_port_shaft();

    // Collar — flipped so clips face the shaft, then pushed onto it
    translate([
        0,
        flange_h,
        flange_thick + gap + flange_thick - explode
    ])
        rotate([180, 0, 0])
            ptfe_port_collar();
}

if (!crosssection_view) {
    ptfe_port_assembly();
} else {
    intersection() {
        ptfe_port_assembly();
        half = flange_w + flange_h;
        // Cut plane passes through the model center + offset
        cx = flange_w / 2 + crosssection_pos;
        cy = flange_h / 2 + crosssection_pos;
        cz = (flange_thick + gap + flange_thick) / 2 + crosssection_pos;
        if (crosssection_axis == "x")
            translate([cx, -half, -half])
                cube([half * 2, half * 2, half * 2]);
        if (crosssection_axis == "y")
            translate([-half, cy, -half])
                cube([half * 2, half * 2, half * 2]);
        if (crosssection_axis == "z")
            translate([-half, -half, cz])
                cube([half * 2, half * 2, half * 2]);
    }
}
