// --- CUSTOM TREAD: Pospie Memorial ---
// Personalized tread: geometry from ../../tread.scad. Stamp via info_stamp_profile (see ../_stamp-profile-template.scad).

include <../../tread.scad>

// Non-empty profile replaces stamp-generated line1..4 for this render.
info_stamp_profile = [
    ["In Loving Memory of", 3.5],
    ["Leonard and Irene", 4],
    ["Pospie", 4]
];
info_stamp_gaps = [5.5, 5.5, 5.5];
info_stamp_line1_rule = false;
tread_stamp_top = true;
