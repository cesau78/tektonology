// --- TEKTONOLOGY FASTENED KNEELER BOOT — BOLT DRYING RACK ---
// Elevated rack for drying threadlock compound on M3 cap bolts.
// Bolts hang by their heads through holes — threads point down to drip-dry.
include <kneeler-boot-config.scad>

// --- Rack Parameters ---
cols          = 25;     // bolts per row
rows          = 2;      // number of rows
spacing       = head_dia + bolt_clearance;      // center-to-center hole spacing (mm) — must exceed head_dia
plate_thick   = 2 ;      // plate thickness (mm)
edge_margin   = 4;      // margin from outermost hole center to plate edge

// Hole diameter: shaft passes through, head rests on top
hole_dia      = bolt_dia + bolt_clearance * 2; // ~3.7mm — clears shaft, blocks 6mm head

// Hanging geometry — bolt tip should be ~1 inch (25.4mm) above the ground
shaft_below   = bolt_length - plate_thick;                // shaft length hanging below plate
clearance_mm  = 25.4;                                     // 1 inch ground clearance
leg_height    = clearance_mm + shaft_below;               // total leg height

// --- Derived plate dimensions ---
plate_x       = (cols - 1) * spacing + (edge_margin * 2); // length
plate_y       = (rows - 1) * spacing + (edge_margin * 2); // width

// --- Leg geometry ---
leg_width     = 10;
leg_thick     = 4;

// --- Rack assembly ---
module rack() {
    difference() {
        // Elevated plate
        translate([0, 0, leg_height])
            cube([plate_x, plate_y, plate_thick]);

        // Bolt holes — 2 rows × 50 cols
        for (r = [0 : rows - 1])
            for (c = [0 : cols - 1])
                translate([
                    edge_margin + c * spacing,
                    edge_margin + r * spacing,
                    leg_height - 0.1
                ])
                    cylinder(h = plate_thick + 0.2, d = hole_dia, $fn = $fn);
    }

    // Four corner legs (rails along Y for stability)
    leg_positions = [
        [0,                     0],
        [plate_x - leg_thick,   0],
        [0,                     plate_y - leg_width],
        [plate_x - leg_thick,   plate_y - leg_width],
    ];

    for (pos = leg_positions)
        translate([pos[0], pos[1], 0])
            cube([leg_thick, leg_width, leg_height]);

    // Center support legs to prevent sag on long spans
    mid_x = (plate_x - leg_thick) / 2;
    translate([mid_x, 0, 0])
        cube([leg_thick, leg_width, leg_height]);
    translate([mid_x, plate_y - leg_width, 0])
        cube([leg_thick, leg_width, leg_height]);
}

// --- Render ---
crosssection(big) rack();

// --- Info echo ---
echo(str("Plate size: ", plate_x, " x ", plate_y, " x ", plate_thick, " mm"));
echo(str("Total height: ", leg_height + plate_thick, " mm"));
echo(str("Bolt tip clearance from ground: ", clearance_mm, " mm"));
echo(str("Total holes: ", rows * cols));
