// --- TEKTONOLOGY KNEELER BOOT — CUBE OF SLIPPERS ---
// Packs as many slippers as possible into a shipping box.
// Specify box dimensions in inches below.
include <kneeler-boot-config.scad>

// === BOX DIMENSIONS (inches) ===
box_length_in = 12;
box_width_in  = 12;
box_height_in = 12;

// === PACKING GAP (mm) ===
gap_xy = 1; // spacing between slippers in X and Y
gap_z  = 2; // spacing between layers (foam sheet)

// === CONVERSIONS ===
mm_per_in = 25.4;
box_x = box_length_in * mm_per_in;
box_y = box_width_in * mm_per_in;
box_z = box_height_in * mm_per_in;

// === SLIPPER BOUNDING BOX (mm, derived from config) ===
slipper_x = outer_extent * 2;            // full length along X
slipper_y = sole_plate_w + (wall * 2);   // full width along Y
slipper_z = total_h + lip_thickness;     // shell height + lip

// === GRID COUNT ===
cell_x = slipper_x + gap_xy;
cell_y = slipper_y + gap_xy;
cell_z = slipper_z + gap_z;

nx = floor(box_x / cell_x);
ny = floor(box_y / cell_y);
nz = floor(box_z / cell_z);

total_slippers = nx * ny * nz;

// === CONSOLE OUTPUT ===
echo(str("Box: ", box_length_in, "\" x ", box_width_in, "\" x ", box_height_in, "\""));
echo(str("Slipper bbox: ", slipper_x, " x ", slipper_y, " x ", slipper_z, " mm"));
echo(str("Grid: ", nx, " x ", ny, " x ", nz, " = ", total_slippers, " slippers"));

// === TRANSLUCENT BOX OUTLINE ===
%translate([box_x / 2, box_y / 2, box_z / 2])
    cube([box_x, box_y, box_z], center=true);

// === PACK SLIPPERS ===
// Simple box stand-ins — every other row flipped 180° on Z
for (ix = [0 : max(0, nx - 1)])
    for (iy = [0 : max(0, ny - 1)])
        for (iz = [0 : max(0, nz - 1)])
            translate([
                slipper_x / 2 + ix * cell_x,
                slipper_y / 2 + iy * cell_y,
                slipper_z / 2 + iz * cell_z
            ])
            rotate([0, 0, 0])
                cube([slipper_x, slipper_y, slipper_z], center=true);
