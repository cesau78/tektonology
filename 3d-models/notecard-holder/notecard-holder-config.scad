// --- TEKTONOLOGY NOTECARD HOLDER — SHARED CONFIG ---
// Shared parameters for notecard holder

// --- Plate Parameters ---
width          = 130;     // bolts per plate
length          = 130;      // rows of bolts
height         = 50;       // notecard slot height
sections       = 7;      // number of separate plates to print (divide length by this for each plate)
plates = sections + 1;
spacing       = 7;  // center-to-center hole spacing (along X)
row_spacing   = spacing * sin(60);          // tighter Y spacing for hex packing
plate_thick   = 2;      // plate thickness (mm)
edge_margin   = 4;      // margin from outermost hole to plate edge
tolerance = 0.1;

// Hole diameter: shaft passes through, head rests on top plate
// Head margin: (head_dia - hole_dia) / 2 = 1.2mm per side resting on plate
hole_dia      = 5;

// --- Derived plate dimensions ---
stagger       = spacing / 2;                                    // row-1 X offset for staggered pattern
pattern_x     = (width / hole_dia) * spacing + stagger;                 // combined hole pattern width
tab_length    = spacing;                                        // solid margin on each end for leg channels
plate_x       = pattern_x + (edge_margin * 2) + (tab_length * 2);  // plate length
plate_y       = (height / hole_dia) * row_spacing + (edge_margin * 2);  // plate width
hole_x0       = tab_length + edge_margin;                       // first hole X (row 0)
