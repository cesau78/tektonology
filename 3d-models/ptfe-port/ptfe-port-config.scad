// PTFE 4-Tube Passthrough Port — Shared Configuration

// Performance
preview = false;
$fn = preview ? 32 : 64;

// PTFE tube dimensions (standard 1.75mm filament tube)
ptfe_od       = 4.0;   // outer diameter of PTFE tube
ptfe_clearance = 0.1;  // clearance per side for snug push-fit (FDM shrinkage helps grip)
hole_dia      = ptfe_od + ptfe_clearance * 2;

// Tube layout — 2x2 grid
tubes     = 4;
cols      = 2;
rows      = 2;
spacing   = 10;  // center-to-center distance between tubes

// Body dimensions
wall       = 2.0;  // minimum wall around outermost holes
gap        = 0.3;  // space between flanges for tent fabric

// Flange dimensions
flange_thick = 2.0;
flange_extra = 4.0; // how far flange extends beyond body on each side
collar_clearance = 0.15; // clearance per side for collar fit around shaft

// Derived
grid_w = (cols - 1) * spacing;
grid_h = (rows - 1) * spacing;
body_w = grid_w + hole_dia + wall * 2;
body_h = grid_h + hole_dia + wall * 2;
flange_w = body_w + flange_extra * 2;
flange_h = body_h + flange_extra * 2;
corner_r = 3;

// Snap-fit clip dimensions
clip_width = spacing;        // width of each clip (distance between two holes)
clip_thick = 0.8;            // tab thickness (thin for PLA flex)
lip_height = 1.5;            // barb height (catch edge)
lip_depth  = 0.6;            // barb protrusion beyond clip face (PLA-safe)
clip_reach = gap + flange_thick + lip_height; // tab extends through gap, flange, and barb flush with flange bottom
clip_clearance = 0.2;        // clearance around clip in the flange slot

// Stop plate — PTFE tube shoulder at top of shaft
stop_thick    = 1.0;         // thin plate thickness
filament_dia  = 2.0;         // filament passthrough hole (1.75mm filament + clearance)

module rounded_rect(w, h, depth, r) {
    translate([r, r, 0])
        minkowski() {
            cube([w - 2 * r, h - 2 * r, depth / 2]);
            cylinder(h = depth / 2, r = r);
        }
}

module tube_holes(depth) {
    for (c = [0 : cols - 1])
        for (r = [0 : rows - 1])
            translate([
                wall + hole_dia / 2 + c * spacing,
                wall + hole_dia / 2 + r * spacing,
                -1
            ])
                cylinder(h = depth + 2, d = hole_dia);
}
