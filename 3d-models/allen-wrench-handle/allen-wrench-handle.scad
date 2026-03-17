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
socket_clearance = 0.1;    // total across-flats clearance for press fit (mm)
socket_depth    = 18;      // depth of hex socket — holds short arm securely (mm)
socket_chamfer  = 0.5;     // entry chamfer to ease insertion and offset elephant foot (mm)
channel_clearance = 0;     // clearance for the slide-in slot — zero tolerance for tight fit (mm)

// --- Handle Grip ---
grip_height     = 25;      // height of grip section (mm)
grip_rounding   = 3;       // Minkowski sphere radius for comfortable edges (mm)

// --- Shaft (transition between grip and socket tip) ---
shaft_dia       = 14;      // shaft diameter below grip (mm)
shaft_height    = 10;      // shaft length below grip (mm)

// --- Derived ---
socket_r = (wrench_af + socket_clearance) / 2 / cos(30); // circumscribed hex radius
chamfer_r = (wrench_af + socket_clearance + 1.0) / 2 / cos(30); // wider entry chamfer
grip_dia = 2 * (21 - (wrench_af/2));  // sized so 21mm from hex edge to handle edge (mm)
total_height = grip_height + shaft_height;
// Channel: snug slot for the wrench shaft
channel_w = wrench_af; // across-flats, no tolerance — V-groove constrains rotation
channel_reach = grip_dia / 2;  // channel reaches to center of handle (mm)
channel_depth = socket_depth;  // channel depth matches hex socket (mm)
// Top of model: grip Minkowski extends to shaft_height + grip_height - grip_rounding
model_top = shaft_height + grip_height - grip_rounding;

// =====================================================================
// MODULES
// =====================================================================

// Hex socket bore — subtracted from the body to hold the wrench short arm
module hex_socket() {
    rotate([0, 0, 30]) {
        // Main hex bore running up from z=0
        translate([0, 0, -0.01])
            cylinder(h = socket_depth + 0.01, r = socket_r + 0.2, $fn = 6);

        // Entry chamfer — slightly wider hex at the opening to ease insertion
        translate([0, 0, -0.01])
            cylinder(h = socket_chamfer + 0.01, r = chamfer_r, $fn = 6);
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
            cylinder(h = grip_dia + 2, r = hex_r,
                     center = true, $fn = 6);
}

// Rounded grip body — Minkowski sum of cylinder + sphere for smooth edges
module grip_body() {
    translate([0, 0, shaft_height]) {
        minkowski() {
            cylinder(
                h = grip_height - 2 * grip_rounding,
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
