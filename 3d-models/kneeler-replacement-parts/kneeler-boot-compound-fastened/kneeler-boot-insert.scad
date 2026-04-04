include <kneeler-boot-config.scad>
include <kneeler-stamp-common.scad>

// --- TEKTONOLOGY KNEELER BOOT FOOT: 7-RIB INSERT --- // This is the internal TPU insert that slips into the bottom half of the coupler. It has a main rectangular body with 7 evenly spaced semi-cylindrical ribs on the bottom to create a secure, high-friction fit within the socket. The dimensions are designed to be slightly larger than the socket for a tight fit, and the ribs provide additional grip and stability when kneeling. 
socket_depth = 5; //depth of the socket to slip into
core_protrusion = 2; //core extension beyond the socket

tightness = tolerance; // Adjust this: 0.0 for snug, 0.2 for very tight
$fn = preview ?  32 : 64;

ribs = 10;
radius = socket_depth / 2; // Radius of semi-cylinders

// --- Slide-in Flange (matches coupler's bottom groove) ---
flange_clearance = 0.2;  // clearance for smooth slide fit
flange_depth = socket_depth / 4;  // matches coupler's groove_h (1/4 socket depth)
flange_l = sole_plate_l + (groove_overhang * 2) - flange_clearance;
flange_w = sole_plate_w + (groove_overhang * 2) - flange_clearance;

core_depth = socket_depth + core_protrusion;
insert_l = sole_plate_l + tightness;
insert_w = sole_plate_w + tightness;
insert_z_top = socket_depth / 2 + core_depth / 2;
insert_stamp_radial_ref = min(insert_l, insert_w) / 2;

module insert_positive() {
    pitch = (insert_l - (2 * radius)) / (ribs - 1);

    union() {
        translate([0, 0, socket_depth/2])
            cube([insert_l, insert_w, core_depth], center=true);

        translate([0, 0, socket_depth/2 + core_depth/2 - flange_depth/2 - 1])
            minkowski() {
                cube([flange_l - 2, flange_w - 2, flange_depth], center=true);
                sphere(r=1.0);
            }

        for (i = [0 : ribs - 1]) {
            x_pos = (i * pitch) - (insert_l/2) + radius;
            z_axis = -1 * (core_protrusion / 2);
            translate([x_pos, 0, z_axis])
                rotate([90, 0, 0])
                    cylinder(h = insert_w, r = radius, center = true);
        }
    }
}

module main() {
    difference() {
        insert_positive();
        part_top_info_stamp_deboss(kneeler_boot_insert_stamp_top, insert_z_top, insert_stamp_radial_ref);
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