// Spool Slot Guide — Clips into oval indicator window on spool rim
// A guide post that extends outward from the rim, pulling the filament
// away from the spool surface to prevent snagging on rim edges/slots.
//
// Coordinate system:
//   Origin = center of the oval window
//   +Z     = outward from the spool rim (away from spool center)
//   +X     = along the rim circumference
//   +Y     = along the spool width (axial)

// Performance Settings
preview = false;
crosssection_view = false;
crosssection_axis = "x";
crosssection_pos = 0;

$fn = preview ? 32 : 64;

// --- Spool Rim Window (measure your spool) ---
window_width    = 20.0;   // oval window width along rim circumference (mm)
window_height   = 10.0;   // oval window height along spool axis (mm)
rim_thickness   = 2.0;    // thickness of spool rim wall (mm)

// --- Base Plate (sits inside the window) ---
base_clearance  = 0.4;    // clearance per side so base fits in window (mm)
base_width      = window_width - base_clearance * 2;
base_height     = window_height - base_clearance * 2;

// --- Retention Lip (hooks over rim edges to hold it in place) ---
lip_depth       = 2.5;    // how far lip extends over rim surface (mm)
lip_thickness   = 1.2;    // thickness of the lip (mm)

// --- Guide Post (extends outward to redirect filament) ---
post_height     = 15.0;   // how far the guide sticks out from the rim (mm)
post_dia        = 6.0;    // diameter of the guide post (mm)
post_rounding   = 1.0;    // rounding on the post tip for smooth filament contact (mm)

// --- Filament Groove (optional groove at top of post to keep filament centered) ---
groove_dia      = 2.0;    // width of the groove channel (mm)
groove_depth    = 1.0;    // how deep the groove cuts into the post (mm)

// =====================================================================
// MODULES
// =====================================================================

// Base plate — oval that sits in the window opening
module base_plate() {
    // Oval shape via scaled cylinder to match the window
    translate([0, 0, -rim_thickness / 2])
        scale([base_width / base_height, 1, 1])
            cylinder(h = rim_thickness, d = base_height);
}

// Retention lips — flanges that hook over the inner and outer rim faces
// to hold the guide in place without interfering with spool rotation
module retention_lips() {
    lip_w = base_width * 0.7;  // lips are narrower than the base for flex

    // Outer lip (on the outside face of the rim)
    translate([0, 0, rim_thickness / 2])
        for (dy = [-1, 1]) {
            translate([0, dy * (base_height / 2 - lip_thickness / 2), 0])
                cube([lip_w, lip_thickness, lip_depth], center = true);
        }

    // Inner lip (on the inside face of the rim)
    translate([0, 0, -rim_thickness / 2 - lip_depth])
        for (dy = [-1, 1]) {
            translate([0, dy * (base_height / 2 - lip_thickness / 2), 0])
                cube([lip_w, lip_thickness, lip_depth], center = true);
        }
}

// Guide post — smooth rounded post extending outward from the rim
module guide_post() {
    translate([0, 0, rim_thickness / 2]) {
        // Tapered base for strength
        cylinder(h = 3, d1 = post_dia + 2, d2 = post_dia);

        // Main post shaft
        cylinder(h = post_height - post_rounding, d = post_dia);

        // Rounded tip via Minkowski
        translate([0, 0, post_height - post_rounding * 2 - 0.01])
            minkowski() {
                cylinder(h = 0.01, d = post_dia - post_rounding * 2);
                sphere(r = post_rounding);
            }
    }
}

// Filament groove — ring channel near the top of the post
module filament_groove() {
    groove_z = rim_thickness / 2 + post_height - post_rounding - groove_dia;
    translate([0, 0, groove_z])
        rotate_extrude()
            translate([post_dia / 2, 0, 0])
                circle(d = groove_dia);
}

// Complete spool slot guide
module spool_slot_guide() {
    difference() {
        union() {
            base_plate();
            retention_lips();
            guide_post();
        }
        filament_groove();
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
crosssection(50)
    spool_slot_guide();
