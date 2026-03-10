// --- TEKTONOLOGY FASTENED KNEELER BOOT — BOLT DRYING RACK CONFIG ---
// Shared parameters for drying rack plates and legs.
include <kneeler-boot-config.scad>

// --- Plate Parameters ---
cols          = 25;     // bolts per plate
rows          = 2;      // rows of bolts
spacing       = head_dia + bolt_clearance;  // center-to-center hole spacing (along X)
row_spacing   = spacing * sin(60);          // tighter Y spacing for hex packing
plate_thick   = 2;      // plate thickness (mm)
edge_margin   = 4;      // margin from outermost hole to plate edge

// Hole diameter: shaft passes through, head rests on top plate
// Head margin: (head_dia - hole_dia) / 2 = 1.2mm per side resting on plate
hole_dia      = bolt_dia + bolt_clearance * 2;

// --- Derived plate dimensions ---
stagger       = spacing / 2;                                    // row-1 X offset for staggered pattern
pattern_x     = (cols - 1) * spacing + stagger;                 // combined hole pattern width
tab_length    = spacing;                                        // solid margin on each end for leg channels
plate_x       = pattern_x + (edge_margin * 2) + (tab_length * 2);  // plate length
plate_y       = (rows - 1) * row_spacing + (edge_margin * 2);  // plate width
hole_x0       = tab_length + edge_margin;                       // first hole X (row 0)

// End-stop flange at -X end of plate: taller than channel slot, blocks slide-through
stop_width    = 1;      // flange width along X
stop_extra    = 1;      // how much taller than plate_thick (must exceed slot clearance)

// --- Two-plate hanging geometry ---
compound_length = bolt_length / 4;                             // 1/4 shaft sticks below bottom plate
shaft_below_top = bolt_length - plate_thick;                  // shaft below top plate
plate_gap       = shaft_below_top - plate_thick - compound_length; // vertical gap between plates

// Heights (Z positions of plate bottom surfaces)
clearance_mm    = 25.4;                                       // bolt tip ~1 inch above ground
bottom_plate_z  = clearance_mm + compound_length;             // bottom plate Z
top_plate_z     = bottom_plate_z + plate_thick + plate_gap;   // top plate Z

// --- Leg / Channel Parameters ---
slot_tol      = 0.15;   // clearance per side in slot
channel_wall  = 2.5;    // wall thickness on Y sides of each channel
leg_post_x    = 2;      // leg thickness along X (plate slide direction)
detent_h      = 0.4;    // snap detent height — ceiling only (must be >= 1 layer height)
detent_w      = 1.0;    // detent width along X (slide direction)

// Derived leg dimensions
slot_h        = plate_thick + slot_tol * 2;   // slot height (Z)
slot_y        = plate_y + slot_tol * 2;       // slot width (Y) — plate fits inside
leg_post_y    = slot_y + channel_wall * 2;    // total leg Y width
total_height  = top_plate_z + plate_thick + channel_wall; // leg total height

// --- Y-branch (inverted Y) ---
split_z       = total_height / 2;                  // Z where post splits into two branches
splay_angle   = 30;                                // degrees from vertical
splay         = split_z * tan(splay_angle);        // Y offset of each foot from center
foot_w        = leg_post_x;                        // foot pad width (X)
foot_d        = leg_post_y;                        // foot pad depth (Y) — same as post
