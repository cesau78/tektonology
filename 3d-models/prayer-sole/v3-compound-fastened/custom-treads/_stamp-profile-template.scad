// Copy into a new `*-tread.scad` next to this file: `include <../tread.scad>` first, then assignments below.
//
// --- Compact form (recommended): one row per line ---
// Row: [ "text", size, "font", "halign", "valign" ] — only "text" and size required; rest default.
// With a non-empty profile, lines beyond len(profile) are empty (stamp-generated strings are ignored).
//
// info_stamp_profile = [
//     ["Line one", 5],
//     ["Line two", 3.5],
//     ["Line three", 3.5],
//     ["Psalm 145:14", 3.2, "Liberation Sans:style=Bold", "right", "center"],
// ];
// Optional fields per row (after size): font, halign, valign — all three in order if any is set.
//
// info_stamp_gaps = [6.875, 4.375, 4.375];  // [ gap line1–2, line2–3, line3–4 ]
//
// kbc_info_stamp_depth = 0.65;  // optional override; default is in stamp-common.scad for all stamped parts
//
// info_stamp_line1_rule = true;
// tread_stamp_top = true;

// --- Legacy form (export / JSON workflow): leave profile empty, set line1..4 + per-line vars in stamp-generated or overrides ---
// info_stamp_profile = [];
// info_stamp_line1 = "...";
