include <config.scad>
include <stamp-common.scad>

// --- TEKTONOLOGY PRAYER SOLE V3 — TREAD (TPU) ---
// Soft tread that keys into the bottom of the coupler: ribs for grip on the floor,
// optional debossed stamp on the top flat (faces into the socket, hidden when assembled).
socket_depth = 5; //depth of the socket to slip into
core_protrusion = 2; //core extension beyond the socket

tightness = tolerance; // Adjust this: 0.0 for snug, 0.2 for very tight
$fn = preview ?  32 : 64;

ribs = 10;
radius = socket_depth / 2; // Radius of semi-cylinders

// --- Slide-in Flange (matches coupler's bottom groove) ---
flange_clearance = 0.2;  // clearance for smooth slide fit
flange_sphere_r = 1.0;
tread_flange_envelope_z_mm = 3.4;  // sync with bumper-bracket/config.scad
flange_depth = tread_flange_envelope_z_mm - 2 * flange_sphere_r;  // 1.4 mm cube → 3.4 mm envelope
flange_l = sole_plate_l + (groove_overhang * 2) - flange_clearance;
flange_w = sole_plate_w + (groove_overhang * 2) - flange_clearance;

core_depth = socket_depth + core_protrusion;
tread_l = sole_plate_l + tightness;
tread_w = sole_plate_w + tightness;
tread_z_top = socket_depth / 2 + core_depth / 2;
tread_stamp_radial_ref = min(tread_l, tread_w) / 2;

module tread_positive() {
    pitch = (tread_l - (2 * radius)) / (ribs - 1);

    union() {
        translate([0, 0, socket_depth/2])
            cube([tread_l, tread_w, core_depth], center=true);

        translate([0, 0, socket_depth/2 + core_depth/2 - flange_depth/2 - 1])
            minkowski() {
                cube([flange_l - 2, flange_w - 2, flange_depth], center=true);
                sphere(r=flange_sphere_r);
            }

        for (i = [0 : ribs - 1]) {
            x_pos = (i * pitch) - (tread_l/2) + radius;
            z_axis = -1 * (core_protrusion / 2);
            translate([x_pos, 0, z_axis])
                rotate([90, 0, 0])
                    cylinder(h = tread_w, r = radius, center = true);
        }
    }
}

render_text_inlay = false;

module main() {
    if (render_text_inlay) {
        intersection() {
            tread_positive();
            part_top_info_stamp_deboss(tread_stamp_top, tread_z_top, tread_stamp_radial_ref, tread_l / 2);
        }
    } else {
        difference() {
            tread_positive();
            part_top_info_stamp_deboss(tread_stamp_top, tread_z_top, tread_stamp_radial_ref, tread_l / 2);
        }
    }
}

// Optionally render a cross-section (half) view so you can inspect internals
if (!crosssection_view) {
    main();
} else {
    // Intersect the model with a very large half-space cube to show only one side
    intersection() {
        main();
        half_space = sole_plate_l; // large extent to fully cover the model
        // keep the positive side of the chosen axis starting at crosssection_pos
        if (crosssection_axis == "x")
            translate([crosssection_pos, -half_space, -half_space])
                cube([half_space*2, half_space*2, half_space*2]);
        if (crosssection_axis == "y")
            translate([-half_space, crosssection_pos, -half_space])
                cube([half_space*2, half_space*2, half_space*2]);
        if (crosssection_axis == "z")
            translate([-half_space, -half_space, crosssection_pos])
                cube([half_space*2, half_space*2, half_space*2]);
    }
}
