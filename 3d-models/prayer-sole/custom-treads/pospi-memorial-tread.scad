// --- CUSTOM TREAD: Pospi Memorial ---
// Prototype example of a personalized tread with custom debossed text.
// Opens in OpenSCAD as a standalone file; renders the standard v3 tread
// with overridden stamp lines.

include <../v3-compound-fastened/tread.scad>

// Custom stamp text (overrides stamp-generated.scad defaults)
info_stamp_line1 = "In loving memory of";
info_stamp_line1_size = kbc_mark_size_secondary;
info_stamp_line1_rule = false;
info_stamp_gap_1_2 = kbc_mark_size_secondary * 1.5;
kbc_mark_gap_2_3 = kbc_mark_size_secondary * 1.5;
info_stamp_line2 = "Irene and Leonard";
info_stamp_line3 = "Pospi";
info_stamp_line4 = "";

// Enable stamp on tread top face
tread_stamp_top = true;
