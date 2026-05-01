// Copy into a new `*-tread.scad` next to this file: `include <../tread.scad>` first, then assignments below.
//
// === JSON workflow (recommended) ===
//
// 1. Create a <name>.json next to your *-tread.scad with this structure:
//
//    {
//      "rows": [
//        {
//          "halign": "center",         // optional, default "center"
//          "valign": "middle",         // optional, default "middle"  ("top" | "middle" | "bottom")
//          "margin_top": 0,            // optional, spacing above this row (default 0)
//          "margin_bottom": 6.875,     // optional, spacing below this row (default 0)
//          "segments": [
//            { "text": "Line one", "size": 5, "underline": true },
//            { "text": "Line two", "size": 3.5, "font": "Liberation Sans:style=Bold" }
//          ]
//        }
//      ],
//      "depth": 0.65                   // optional, override kbc_info_stamp_depth
//    }
//
//    Row keys:
//      halign        (optional)  "left" | "center" | "right"  (default "center")
//      valign        (optional)  "top" | "middle" | "bottom"  (default "middle")
//      margin_top    (optional)  number — spacing above (default 0)
//      margin_bottom (optional)  number — spacing below (default 0)
//      x_offset      (optional)  number — nudge entire row horizontally (+ right, - left, default 0)
    //      y_offset      (optional)  number — nudge entire row vertically (+ down, - up, default 0)
    //      segments      (required)  array of segment objects
//
//    Segment keys:
//      text      (required)  string — supports {version} placeholder (resolved from stamp-config.json)
//      size      (required)  number — font size
//      font      (optional)  string — defaults to kbc_mark_font
//      sc        (optional)  number — smallcaps size (0 = off)
//      spacing   (optional)  number — inter-character spacing (1 = normal)
//      underline        (optional)  bool   — draw an underline beneath this segment (default false)
    //      underline_scale  (optional)  number — scale the underline width (1 = full, 0.9 = 90%, default 1)
    //      underline_x_offset (optional)  number — horizontal shift in model units (+ right, - left, default 0)
    //      underline_y_offset (optional)  number — vertical shift in model units (+ down, - up, default 0)
//
//    Printability (TPU two-color inlay):
    //      size and sc below 3.5 may not print cleanly — fine details are lost.
    //      Prefer Bold font weights for sizes under 5. The converter warns on sc/size < 3.5.
    //
    //    Template variables:
//      {version}  — replaced with product_version from stamp-config.json
//      Example: { "text": "Prayer Sole {version}", "size": 3.5 }
//
// 2. Run the converter (or use the file watcher):
//      scripts/Convert-StampProfile.ps1                    # all sole-prayers/*.json
//      scripts/Convert-StampProfile.ps1 -JsonPath <file>   # single file
//      scripts/Watch-StampProfiles.ps1                     # auto-regenerate on save
//
// 3. Include the generated file in your *-tread.scad:
//      include <../../tread.scad>
//      include <my-tread-profile.gen.scad>
//
// === Inline OpenSCAD (legacy) ===
//
// You can still define the profile directly in the *-tread.scad file using
// positional arrays. See the segmented and legacy formats below.
//
// --- Segmented form ---
// Each row: [halign, valign, [segment, ...]]
// Each segment: [text, size, font, sc, spacing, underline, underline_scale, underline_x_offset, underline_y_offset]
//   — only text and size are required; font defaults to kbc_mark_font,
//     smallcaps defaults to 0, spacing to 1, underline to false, scale to 1, offsets to 0.
// halign: "left", "center", or "right"  (horizontal alignment of the row)
// valign: "top", "middle", or "bottom"  (vertical alignment of segments within the row)
//
// info_stamp_profile = [
//     ["center", "middle", [
//         ["Line one", 5, "", 0, 1, true],   // underlined
//     ]],
//     ["center", "middle", [
//         ["Line two", 3.5],
//     ]],
//     ["right", "middle", [
//         ["Psalm 145:14", 3.2, "Liberation Sans:style=Bold"],
//     ]],
// ];
//
// --- Multi-segment rows ---
// Each segment within a row can have its own size, font, and underline.
// Segments are laid out left-to-right with estimated monospace advances,
// then the whole row is aligned according to halign.
//
// info_stamp_profile = [
//     ["center", "middle", [
//         ["P.", 6.5, "Consolas:style=Bold"],
//         ["t.", 8.5, "Consolas:style=Bold"],
//         ["L.", 6.5, "Consolas:style=Bold"],
//     ]],
//     ["center", "middle", [
//         ["Praise the Lord", 4.5, "Consolas:style=Bold", 3.5, 1.1],
//     ]],
// ];
//
// --- Small caps (per segment) ---
// Lowercase letters are rendered as uppercase at the specified smallcaps_size.
//   ["Praise the Lord", 3.5, "Consolas:style=Bold", 3]       → smallcaps at size 3
//   ["Praise the Lord", 3.5, "Consolas:style=Bold", 3, 1.1]  → smallcaps + 10% wider
//
// --- Spacing (per segment) ---
// Controls inter-character spacing (1 = normal, >1 = wider, <1 = tighter).
//   ["Line one", 5, "Liberation Sans:style=Bold", 0, 1.2]  → 20% wider, no smallcaps
//
// info_stamp_gaps = [6.875, 4.375, 4.375];  // [ gap row0–1, row1–2, row2–3, ... ]
//
// kbc_info_stamp_depth = 0.65;  // optional override; default is in stamp-common.scad for all stamped parts
//
// tread_stamp_top = true;
//
// --- Two-color (text inlay) ---
// render_text_inlay = true;  // renders only the text as a positive body (export as second STL for white filament)

// --- Legacy flat form (still supported; auto-detected when row[2] is not a list) ---
// Row: [ "text", size, "font", "halign", smallcaps_size, spacing ]
//
// --- Legacy line-variable form (export / JSON workflow): leave profile empty ---
// info_stamp_profile = [];
// info_stamp_line1 = "...";
