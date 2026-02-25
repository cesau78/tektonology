// O-Ring for Liquid Bait Station — Print in TPU 90A
// Designed to sit in the annular groove inside the reservoir bore
// and seal against a standard plastic bottle neck.

// Performance Settings
preview = true;
$fn = preview ? 48 : 128;

// O-Ring Dimensions (AS568-118 style)
oring_cs = 2.62;       // cross-section diameter (mm)
oring_id = 22.0;       // inner diameter (mm) — seats snug against ~24mm bottle neck

// Computed
oring_ring_r = (oring_id / 2) + (oring_cs / 2); // centerline radius of the torus

// Render the O-ring as a torus
rotate_extrude()
    translate([oring_ring_r, 0, 0])
        circle(d = oring_cs);
