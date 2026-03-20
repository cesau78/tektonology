// Ergonomic T-Handle for 2.5mm Allen Wrench
// Grips the short arm of a standard L-shaped hex key for comfortable
// M3 socket head cap screw assembly.

// Performance Settings
preview = false; // set preview=true for faster rendering with lower detail
crosssection_view = false; // set to true to cut the model and show internals
crosssection_axis = "y"; // axis: 'x', 'y', or 'z'
crosssection_pos = 0.5; // position (mm) along the chosen axis where the cut occurs

$fn = preview ? 32 : 64;

// --- Allen Key Dimensions ---
wrench_af       = 2.5;     // across-flats of hex key (mm)
wrench_ac       = 2.8; // across-corners (mm)
wrench_short_arm = 19.6;      // length of short arm that fits in the socket (mm)
wrench_long_arm = 57;         // length of long arm that passes through the handle (mm)

socket_clearance = 0.4;    // total across-flats clearance for press fit (mm)
socket_depth    = 18;      // depth of hex socket — holds short arm securely (mm)
socket_chamfer  = 0.5;     // entry chamfer to ease insertion and offset elephant foot (mm)

// --- Handle Grip ---
grip_height     = wrench_long_arm / 4;      // height of grip section (mm)
grip_rounding   = 3;       // Minkowski sphere radius for comfortable edges (mm)
grip_base = grip_height / 2;

// --- Grip Grooves ---
groove_count    = 12;       // number of grooves around perimeter
groove_radius   = 3.5;        // radius of each cylindrical groove (mm)
groove_depth    = 1.5;      // how deep the groove cuts into the surface (mm)

// --- Shaft (transition between grip and socket tip) ---
shaft_dia       = wrench_ac + 6;      // shaft diameter below grip (mm)
shaft_height    = grip_height / 2;      // shaft length below grip (mm)

// --- Derived ---
grip_dia = 2 * (wrench_short_arm - (wrench_af/2)) + groove_depth * 2 + 2;  // sized so 22mm from hex edge to handle edge (mm)
total_height = grip_height + shaft_height + grip_base;

// Channel: snug slot for the wrench shaft
channel_w = wrench_ac - 0.1; // across-flats, no tolerance — V-groove constrains rotation
channel_reach = grip_dia / 2;  // channel reaches to center of handle (mm)
channel_depth = socket_depth;  // channel depth matches hex socket (mm)

// Top of model: grip Minkowski extends to shaft_height + grip_height - grip_rounding
model_top = shaft_height + grip_height + grip_base - grip_rounding;

// =====================================================================
// MODULES
// =====================================================================

// Hex socket bore — subtracted from the body to hold the wrench short arm
module hex_socket() {
    rotate([0, 0, 0]) {
        // Main hex bore running up from z=0
        translate([0, 0, -0.01])
            cylinder(h = socket_depth + 0.02, r = wrench_ac / 2 + socket_clearance / 2, $fn = 6);
    }
}

// Half-slot — runs from the edge of the handle to center, cut from the top
// down to the hex socket. Slide the long arm in from one side; the snug
// fit holds the wrench in place.
module wrench_channel() {
    channel_len = channel_reach + 1;
    channel_start_y = grip_dia / 2 - channel_reach;

    // Rectangular portion above the V
    translate([-channel_w / 2, channel_start_y, -1])
        cube([channel_w, channel_len, channel_depth + 1]);
}

// Horizontal hex through-hole — lets long arm pass through for alternate grip.
module hex_through_hole() {
    hex_r = wrench_af / 2 / cos(30); // circumscribed radius
    hole_z = channel_depth;
    translate([0, 0, hole_z])
        rotate([90, 0, 0])
            cylinder(h = grip_dia + 2, r = wrench_ac / 2 + socket_clearance / 2,
                     center = true, $fn = 6);
}

// Rounded grip body — Minkowski sum of cylinder + sphere for smooth edges
module grip_body() {
    translate([0, 0, shaft_height]) {
        minkowski() {
            cylinder(
                h = grip_base + grip_height - 2 * grip_rounding,
                d = grip_dia - 2 * grip_rounding
            );
            sphere(r = grip_rounding);
        }
    }
}

// Tapered shaft — transitions from grip diameter down to shaft diameter
module shaft_body() {
    hull() {
        // Top disc where shaft meets grip
        translate([0, 0, shaft_height - 0.01])
            cylinder(h = 0.01, d = grip_dia);
        // Bottom disc at base
        cylinder(h = 0.01, d = shaft_dia);
    }
}

// Cylindrical grooves running along the z-axis around the grip perimeter
module grip_grooves() {
    groove_center_r = grip_dia / 2 - groove_depth / 4; // center of groove cylinder (pushed outward)
    for (i = [0 : groove_count - 1]) {
        angle = i * 360 / groove_count;
        translate([groove_center_r * cos(angle),
                   groove_center_r * sin(angle),
                   -1])
            cylinder(h = total_height + grip_rounding + 2, r = groove_radius);
    }
}

// Complete handle assembly
module allen_wrench_handle() {
    difference() {
        union() {
            grip_body();
            shaft_body();
        }
        hex_socket();
        wrench_channel();
        hex_through_hole();
        grip_grooves();
    }
}

// =====================================================================
// CROSS-SECTION SUPPORT
// =====================================================================
module crosssection(half_space) {
    if (!crosssection_view) {
        children();
    } else {
        intersection() {
            children();
            if (crosssection_axis == "x")
                translate([crosssection_pos, -half_space, -half_space])
                    cube([half_space * 2, half_space * 2, half_space * 2]);
            if (crosssection_axis == "y")
                translate([-half_space, crosssection_pos, -half_space])
                    cube([half_space * 2, half_space * 2, half_space * 2]);
            if (crosssection_axis == "z")
                translate([-half_space, -half_space, crosssection_pos])
                    cube([half_space * 2, half_space * 2, half_space * 2]);
        }
    }
}

// =====================================================================
// RENDERING
// =====================================================================
crosssection(grip_dia)
    translate([0, 0, model_top])
        rotate([180, 0, 0])
            allen_wrench_handle();
