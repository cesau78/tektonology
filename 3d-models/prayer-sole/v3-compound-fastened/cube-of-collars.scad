// --- TEKTONOLOGY PRAYER SOLE V3 — CUBE OF COLLARS ---
// Packs as many collars as possible into a shipping box.
// Specify box dimensions in inches below.
include <config.scad>

// === BOX DIMENSIONS (inches) ===
box_length_in = 12;
box_width_in  = 12;
box_height_in = 12;

// === PACKING GAP (mm) ===
gap_xy = 1; // spacing between collars in X and Y
gap_z  = 2; // spacing between layers (foam sheet)
box_tolerance = 0.1; // inset from box walls on each side

// === CONVERSIONS ===
mm_per_in = 25.4;
box_x = box_length_in * mm_per_in;
box_y = box_width_in * mm_per_in;
box_z = box_height_in * mm_per_in;

// === COLLAR BOUNDING BOX (mm, derived from config) ===
collar_x = outer_extent * 2;            // full length along X
collar_y = sole_plate_w + (wall * 2);   // full width along Y
collar_z = total_h + lip_thickness;     // shell height + lip

// === GRID COUNT ===
// Use gap for initial fit count
cell_x = collar_x + gap_xy;
cell_y = collar_y + gap_xy;
cell_z = collar_z + gap_z;

nx = floor(box_x / cell_x);
ny = floor(box_y / cell_y);
nz = floor(box_z / cell_z);

// === FLUSH STRIDE ===
// Distribute collars so outer edges sit box_tolerance inset from the box walls.
// Usable span is box minus box_tolerance on each side.
usable_x = box_x - 2 * box_tolerance;
usable_y = box_y - 2 * box_tolerance;
usable_z = box_z - 2 * box_tolerance;

stride_x = (nx > 1) ? (usable_x - collar_x) / (nx - 1) : 0;
stride_y = (ny > 1) ? (usable_y - collar_y) / (ny - 1) : 0;
stride_z = (nz > 1) ? (usable_z - collar_z) / (nz - 1) : 0;

total_collars = nx * ny * nz;

// === CONSOLE OUTPUT ===
echo(str("Box: ", box_length_in, "\" x ", box_width_in, "\" x ", box_height_in, "\""));
echo(str("Collar bbox: ", collar_x, " x ", collar_y, " x ", collar_z, " mm"));
echo(str("Grid: ", nx, " x ", ny, " x ", nz, " = ", total_collars, " collars"));

// === TRANSLUCENT BOX OUTLINE ===
%translate([box_x / 2, box_y / 2, box_z / 2])
    cube([box_x, box_y, box_z], center=true);

// === PACK COLLARS ===
// Each z-layer is the same grid, but odd layers rotate the whole
// plane 90° around the box centre for a cross-hatched stack.
for (iz = [0 : max(0, nz - 1)])
    translate([box_x / 2, box_y / 2, 0])
    rotate([0, 0, (iz % 2) * 90])
    translate([-box_x / 2, -box_y / 2, 0])
        for (ix = [0 : max(0, nx - 1)])
            for (iy = [0 : max(0, ny - 1)])
                translate([
                    box_tolerance + collar_x / 2 + ix * stride_x,
                    box_tolerance + collar_y / 2 + iy * stride_y,
                    box_tolerance + collar_z / 2 + iz * stride_z
                ])
                cube([collar_x, collar_y, collar_z], center=true);
