// Copy into a new `*-tread.scad` next to this file: `include <../tread.scad>` first, then assignments below.
//
// --- Compact form (recommended): one row per line ---
// Row: [ "text", size, "font", "halign", smallcaps_size, spacing ] — only "text" and size required; rest default.
// With a non-empty profile, lines beyond len(profile) are empty (stamp-generated strings are ignored).
//
// info_stamp_profile = [
//     ["Line one", 5],
//     ["Line two", 3.5],
//     ["Line three", 3.5],
//     ["Psalm 145:14", 3.2, "Liberation Sans:style=Bold", "right"],
// ];
// Optional fields per row (after size): font, halign, smallcaps_size, spacing — in order if any is set.
//
// --- Small caps ---
// Lowercase letters are rendered as uppercase at the specified smallcaps_size.
// Shorthand (3rd element is a number = smallcaps, default font/halign):
//   ["Praise the Lord", 3.5, 3]
// With font override:
//   ["Praise the Lord", 3.5, "Arial:style=Bold", "center", 3]
//
// --- Spacing ---
// Controls inter-character spacing (1 = normal, >1 = wider, <1 = tighter).
// Works for both regular text and small caps.
//   ["Line one", 5, "Liberation Sans:style=Bold", "center", 0, 1.2]  →  20% wider, no smallcaps
// Shorthand (after smallcaps_size):
//   ["Praise the Lord", 3.5, 3, 1.1]  →  smallcaps + 10% wider
//
// info_stamp_gaps = [6.875, 4.375, 4.375];  // [ gap line1–2, line2–3, line3–4 ]
//
// kbc_info_stamp_depth = 0.65;  // optional override; default is in stamp-common.scad for all stamped parts
//
// info_stamp_line1_rule = true;
// tread_stamp_top = true;
//
// --- Two-color (text inlay) ---
// render_text_inlay = true;  // renders only the text as a positive body (export as second STL for white filament)

// --- Legacy form (export / JSON workflow): leave profile empty, set line1..4 + per-line vars in stamp-generated or overrides ---
// info_stamp_profile = [];
// info_stamp_line1 = "...";
