// PTFE 4-Tube Passthrough Port — Shared Configuration

// Performance
preview = false;
$fn = preview ? 32 : 64;

// PTFE tube dimensions (standard 1.75mm filament tube)
ptfe_od       = 4.0;   // outer diameter of PTFE tube
// Slight undersize bore grips tube; filament through stop plate helps retention when crimped
ptfe_clearance = -0.05;  // per side: negative = interference on OD (tune for your printer/filament)
hole_dia      = ptfe_od + ptfe_clearance * 2;

// Tube layout — 2x2 grid
tubes     = 4;
cols      = 2;
rows      = 2;
spacing   = 10;  // center-to-center distance between tubes

// Body dimensions
wall       = 2.0;  // minimum wall around outermost holes
gap        = 1.0;  // space between flanges for tent fabric

// Flange dimensions
flange_thick = 2.0;
flange_extra = 6.0; // extension beyond body each side (+50% vs 4 mm for canvas stability)
collar_clearance = 0.15; // clearance per side for collar fit around shaft
collar_scale     = 1;    // 1 = collar face matches flange footprint for even canvas support

// Derived
grid_w = (cols - 1) * spacing;
grid_h = (rows - 1) * spacing;
body_w = grid_w + hole_dia + wall * 2;
body_h = grid_h + hole_dia + wall * 2;
flange_w = body_w + flange_extra * 2;
flange_h = body_h + flange_extra * 2;
collar_w = flange_w * collar_scale;
collar_h = flange_h * collar_scale;
corner_r = 3;

// Snap-fit clip dimensions
clip_width = spacing;        // width of each clip (distance between two holes)
clip_thick = 1.6;            // tab thickness (doubled for stronger retention)
lip_height = 3.5;            // barb height (catch edge)
lip_depth  = 0.6;            // barb protrusion beyond clip face (PLA-safe)
barb_shelf_offset_z = 1;     // shifts barb/catch shelf +Z along tab (toward flange outer face)
clip_reach = gap + flange_thick + lip_height + barb_shelf_offset_z; // tab through gap + flange + barb
clip_clearance = 0.2;        // clearance around clip in the flange slot

// PTFE tube socket depth — how far tubes insert past stop plate
socket_depth_top    = 5.0;   // top (flange side) shaft socket
socket_depth_bottom = 10.0;   // bottom (opposite side) shaft socket

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
