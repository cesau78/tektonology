// O-Ring for Liquid Bait Station — Print in TPU 90A
// Designed to sit in the annular groove inside the reservoir bore
// and seal against a standard plastic bottle neck.

// Performance Settings
preview = false;
$fn = preview ? 48 : 128;

// O-Ring Dimensions (AS568-118 style)
// Must match groove in liquid-bait-station.scad (cut at reservoir_id/2 = 12.5mm radius)
oring_cs = 2.62;       // cross-section diameter (mm)
oring_id = 22.4;       // inner diameter (mm) — places centerline at bore wall (r=12.5mm)

// Computed
oring_ring_r = (oring_id / 2) + (oring_cs / 2); // centerline radius = 12.51mm ≈ bore wall

// Render the O-ring as a torus
rotate_extrude()
    translate([oring_ring_r, 0, 0])
        circle(d = oring_cs);
