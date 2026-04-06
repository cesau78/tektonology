// --- CUSTOM TREAD: Pospi Memorial ---
// Prototype example of a personalized tread with custom debossed text.
// Opens in OpenSCAD as a standalone file; renders the standard v3 tread
// with overridden stamp lines.

include <../v3-compound-fastened/tread.scad>

// Custom stamp text (overrides stamp-generated.scad defaults)
info_stamp_line1 = "In loving memory of";
info_stamp_line2 = "Irene and Leni Pospi";
info_stamp_line3 = "";
info_stamp_line4 = "Tektonology";
info_stamp_line4_halign = "right";

// Enable stamp on tread top face
tread_stamp_top = true;
