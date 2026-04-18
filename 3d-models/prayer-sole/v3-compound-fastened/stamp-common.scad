// Product info deboss (lines from stamp-generated.scad; export script writes it).
// Top face: mates against coupler — hidden when assembled.

include <stamp-generated.scad>

kbc_info_stamp_depth = 1.2;

kbc_mark_size = 5;
kbc_mark_size_secondary = 3.5;
kbc_mark_size_tertiary = 3.5;
kbc_mark_gap_2_3 = kbc_mark_size_secondary * 1.25;
// Vertical gap between stamp lines 3 and 4 (line 2–3 spacing uses kbc_mark_gap_2_3).
kbc_mark_gap_3_4 = kbc_mark_gap_2_3;
kbc_mark_gap_extra_brand_to_product = 2.5;
kbc_mark_gap_1_2 = kbc_mark_gap_2_3 + kbc_mark_gap_extra_brand_to_product;
kbc_mark_rule_adv_per_char = 0.78;
kbc_mark_rule_stroke_scale = 0.132;
kbc_mark_rule_right_inset = 0.40;
// Line 1 uses valign=center; this estimates how far below that center the lowest descender (e.g. “y”) ends, in × line1 size. Rule top is placed flush with that Y.
kbc_mark_rule_line1_descender_factor = 0.50;
// Rectangular tread: keep 0 so the stack stays centered on the top face (+Y rim shift is for round parts).
kbc_mark_radial_shift_fraction = 0;
kbc_mark_font = "Consolas:style=Bold";
// Per-line overrides (custom tread .scad files can set these after include <tread.scad>).
info_stamp_line1_size = kbc_mark_size;
info_stamp_line2_size = kbc_mark_size_secondary;
info_stamp_line3_size = kbc_mark_size_secondary;
info_stamp_line4_size = kbc_mark_size_tertiary;
info_stamp_line1_font = kbc_mark_font;
info_stamp_line2_font = kbc_mark_font;
info_stamp_line3_font = kbc_mark_font;
info_stamp_line4_font = kbc_mark_font;
info_stamp_line1_halign = "center";
info_stamp_line1_valign = "center";
info_stamp_line2_halign = "center";
info_stamp_line2_valign = "center";
info_stamp_line3_halign = "center";
info_stamp_line3_valign = "center";
info_stamp_line4_halign = "center";
info_stamp_line4_valign = "center";
info_stamp_line1_smallcaps = 4;
info_stamp_line2_smallcaps = 3;
info_stamp_line3_smallcaps = 3;
info_stamp_line4_smallcaps = 3;
info_stamp_line1_spacing = 1.2;
info_stamp_line2_spacing = 1.1;
info_stamp_line3_spacing = 1.1;
info_stamp_line4_spacing = 1.1;
info_stamp_line1_rule = true;
info_stamp_gap_1_2 = kbc_mark_gap_1_2;

// Compact custom layouts: non-empty list switches line source to profile rows (legacy line1..4 ignored for text).
// Each row: [ "text", size, "font", "halign", smallcaps_size, spacing ]
//   — omit trailing entries to use defaults (font kbc_mark_font, halign center, no smallcaps, spacing 1).
// Shorthand: if 3rd element is a number, it is smallcaps_size (default font/halign assumed):
//   ["Praise the Lord", 3.5, 3]      →  smallcaps at size 3, default font/spacing.
//   ["Praise the Lord", 3.5, 3, 1.1] →  smallcaps at size 3, spacing 1.1.
info_stamp_profile = [];
// Optional [ gap between line1–2, line2–3, line3–4 ]; empty [] uses info_stamp_gap_1_2 + kbc_mark_gap_2_3 / _3_4.
info_stamp_gaps = [];

function stamp_default_size_for_line(i) =
    i == 0 ? kbc_mark_size
    : i == 3 ? kbc_mark_size_tertiary
    : kbc_mark_size_secondary;

function stamp_prof_text(row) = row[0];
function stamp_prof_size(row, i) =
    len(row) >= 2 ? row[1] : stamp_default_size_for_line(i);
function _stamp_row_sc_shorthand(row) = len(row) >= 3 && is_num(row[2]);
function stamp_prof_font(row, def) =
    len(row) >= 3 && is_string(row[2]) ? row[2] : def;
function stamp_prof_h(row, def) =
    _stamp_row_sc_shorthand(row) ? def :
    len(row) >= 4 && is_string(row[3]) ? row[3] : def;
function stamp_prof_sc(row) =
    _stamp_row_sc_shorthand(row) ? row[2] :
    len(row) >= 4 && is_num(row[3]) ? row[3] :
    len(row) >= 5 && is_num(row[4]) ? row[4] : 0;
function stamp_prof_spacing(row) =
    _stamp_row_sc_shorthand(row)
        ? (len(row) >= 4 && is_num(row[3]) ? row[3] : 1)
        : (len(row) >= 6 && is_num(row[5]) ? row[5] : 1);

function stamp_use_profile() = len(info_stamp_profile) > 0;

function stamp_legacy_text(i) =
    i == 0 ? info_stamp_line1
    : i == 1 ? info_stamp_line2
    : i == 2 ? info_stamp_line3
    : info_stamp_line4;

function stamp_eff_text(i) =
    stamp_use_profile()
        ? (i < len(info_stamp_profile) ? stamp_prof_text(info_stamp_profile[i]) : "")
        : stamp_legacy_text(i);

function stamp_legacy_size(i) =
    i == 0 ? info_stamp_line1_size
    : i == 1 ? info_stamp_line2_size
    : i == 2 ? info_stamp_line3_size
    : info_stamp_line4_size;

function stamp_eff_size(i) =
    stamp_use_profile() && i < len(info_stamp_profile)
        ? stamp_prof_size(info_stamp_profile[i], i)
        : stamp_legacy_size(i);

function stamp_legacy_font(i) =
    i == 0 ? info_stamp_line1_font
    : i == 1 ? info_stamp_line2_font
    : i == 2 ? info_stamp_line3_font
    : info_stamp_line4_font;

function stamp_eff_font(i) =
    stamp_use_profile() && i < len(info_stamp_profile)
        ? stamp_prof_font(info_stamp_profile[i], kbc_mark_font)
        : stamp_legacy_font(i);

function stamp_legacy_h(i) =
    i == 0 ? info_stamp_line1_halign
    : i == 1 ? info_stamp_line2_halign
    : i == 2 ? info_stamp_line3_halign
    : info_stamp_line4_halign;

function stamp_eff_h(i) =
    stamp_use_profile() && i < len(info_stamp_profile)
        ? stamp_prof_h(info_stamp_profile[i], "center")
        : stamp_legacy_h(i);

function stamp_legacy_sc(i) =
    i == 0 ? info_stamp_line1_smallcaps
    : i == 1 ? info_stamp_line2_smallcaps
    : i == 2 ? info_stamp_line3_smallcaps
    : info_stamp_line4_smallcaps;

function stamp_eff_sc(i) =
    stamp_use_profile() && i < len(info_stamp_profile)
        ? stamp_prof_sc(info_stamp_profile[i])
        : stamp_legacy_sc(i);

function stamp_legacy_spacing(i) =
    i == 0 ? info_stamp_line1_spacing
    : i == 1 ? info_stamp_line2_spacing
    : i == 2 ? info_stamp_line3_spacing
    : info_stamp_line4_spacing;

function stamp_eff_spacing(i) =
    stamp_use_profile() && i < len(info_stamp_profile)
        ? stamp_prof_spacing(info_stamp_profile[i])
        : stamp_legacy_spacing(i);

// --- Small Caps ---
// Renders lowercase letters as uppercase at a reduced size, baseline-aligned.
// sc_advance_factor: average character advance as fraction of font size.
// Default matches kbc_mark_rule_adv_per_char; override per-tread to tune spacing.
sc_advance_factor = 0.64;

function _sc_is_lower(ch) = let(c = ord(ch)) (c != undef && c >= 97 && c <= 122);
function _sc_upper(ch) = _sc_is_lower(ch) ? chr(ord(ch) - 32) : ch;

function _sc_ch_advance(ch, full_sz, sc_sz, sp=1) =
    let(rsz = _sc_is_lower(ch) ? sc_sz : full_sz)
    sc_advance_factor * rsz * sp;

function _sc_total_w(s, fsz, ssz, sp=1, i=0) =
    i >= len(s) ? 0 :
    _sc_ch_advance(s[i], fsz, ssz, sp) + _sc_total_w(s, fsz, ssz, sp, i+1);

function _sc_x_at(s, fsz, ssz, idx, sp=1, i=0) =
    i >= idx ? 0 :
    _sc_ch_advance(s[i], fsz, ssz, sp) + _sc_x_at(s, fsz, ssz, idx, sp, i+1);

module _smallcaps_line(s, size, sc_size, font, halign="center", spacing=1) {
    tw = _sc_total_w(s, size, sc_size, spacing);
    x0 = (halign == "center") ? -tw/2 :
         (halign == "right")  ? -tw : 0;
    y0 = -size * 0.35;
    translate([x0, y0, 0])
        for (i = [0 : max(0, len(s)-1)]) {
            ch = s[i];
            rch = _sc_upper(ch);
            rsz = _sc_is_lower(ch) ? sc_size : size;
            translate([_sc_x_at(s, size, sc_size, i, spacing), 0, 0])
                text(rch, size=rsz, font=font, halign="left", valign="baseline");
        }
}

module _stamp_text(s, size, sc_size, font, halign, spacing=1) {
    if (sc_size > 0)
        _smallcaps_line(s, size, sc_size, font, halign, spacing);
    else
        text(s, size=size, font=font, halign=halign, valign="center", spacing=spacing);
}

// Deboss on the top flat (z = z_top), read from above into the coupler socket.
module part_top_info_stamp_deboss(enable, z_top, radial_ref, text_x_half=0) {
    depth = kbc_info_stamp_depth + 0.02;
    _tx_inset = 1.5;
    _tx_edge = text_x_half > 0 ? text_x_half - _tx_inset : 0;
    g12 = len(info_stamp_gaps) >= 1 ? info_stamp_gaps[0] : info_stamp_gap_1_2;
    g23 = len(info_stamp_gaps) >= 2 ? info_stamp_gaps[1] : kbc_mark_gap_2_3;
    g34 = len(info_stamp_gaps) >= 3 ? info_stamp_gaps[2] : kbc_mark_gap_3_4;
    y1 = g12;
    y2 = 0;
    y3 = -g23;
    y4 = y3 - g34;
    ys = [y1, y2, y3, y4];
    t0 = stamp_eff_text(0);
    t1 = stamp_eff_text(1);
    t2 = stamp_eff_text(2);
    t3 = stamp_eff_text(3);
    s0 = stamp_eff_size(0);
    s1 = stamp_eff_size(1);
    s2 = stamp_eff_size(2);
    s3 = stamp_eff_size(3);
    f0 = stamp_eff_font(0);
    f1 = stamp_eff_font(1);
    f2 = stamp_eff_font(2);
    f3 = stamp_eff_font(3);
    h0 = stamp_eff_h(0);
    h1 = stamp_eff_h(1);
    h2 = stamp_eff_h(2);
    h3 = stamp_eff_h(3);
    sc0 = stamp_eff_sc(0);
    sc1 = stamp_eff_sc(1);
    sc2 = stamp_eff_sc(2);
    sc3 = stamp_eff_sc(3);
    sp0 = stamp_eff_spacing(0);
    sp1 = stamp_eff_spacing(1);
    sp2 = stamp_eff_spacing(2);
    sp3 = stamp_eff_spacing(3);
    hx0 = _tx_edge > 0 ? (h0 == "left" ? -_tx_edge : h0 == "right" ? _tx_edge : 0) : 0;
    hx1 = _tx_edge > 0 ? (h1 == "left" ? -_tx_edge : h1 == "right" ? _tx_edge : 0) : 0;
    hx2 = _tx_edge > 0 ? (h2 == "left" ? -_tx_edge : h2 == "right" ? _tx_edge : 0) : 0;
    hx3 = _tx_edge > 0 ? (h3 == "left" ? -_tx_edge : h3 == "right" ? _tx_edge : 0) : 0;
    // When line 2 is empty, pull lines 3–4 up into those slots so the block stays tight.
    use_line2 = t1 != "";
    y_text_3 = use_line2 ? ys[2] : ys[1];
    y_text_4 = use_line2 ? ys[3] : ys[2];
    stamp_shift_y = radial_ref * kbc_mark_radial_shift_fraction;
    // Vertical center of line stack (glyph centers ± half-em); shifts block so midline sits at Y=0 before radial nudge.
    stamp_bbox_top =
        (t0 != "") ? (y1 + s0 / 2)
        : (t1 != "") ? (y2 + s1 / 2)
        : (t2 != "") ? (y_text_3 + s2 / 2)
        : (y_text_4 + s3 / 2);
    stamp_bbox_bot =
        (t3 != "") ? (y_text_4 - s3 / 2)
        : (t2 != "") ? (y_text_3 - s2 / 2)
        : (t1 != "") ? (y2 - s1 / 2)
        : (y1 - s0 / 2);
    stamp_vertical_center_adj = -(stamp_bbox_top + stamp_bbox_bot) / 2;
    has_any = t0 != "" || t1 != "" || t2 != "" || t3 != "";
    if (enable && has_any) {
        translate([0, stamp_shift_y, z_top + 0.01])
            rotate([180, 0, 0])
            mirror([1, 0, 0])
            translate([0, stamp_vertical_center_adj, 0]) {
                if (t0 != "")
                    linear_extrude(depth)
                        translate([hx0, ys[0], 0])
                            _stamp_text(t0, s0, sc0, f0, h0, sp0);
                if (info_stamp_line1_rule && t0 != "" && (t1 != "" || t2 != ""))
                    linear_extrude(depth)
                        let (
                            nch = max(len(t0), 1),
                            adv = len(t0) * s0 * kbc_mark_rule_adv_per_char,
                            cw = adv / nch,
                            rule_t = max(0.28, s0 * kbc_mark_rule_stroke_scale),
                            x0 = -adv / 2,
                            x1 = adv / 2 - cw * kbc_mark_rule_right_inset,
                            line1_bottom_y = y1 - s0 * kbc_mark_rule_line1_descender_factor,
                            y_rule = line1_bottom_y - rule_t / 2
                        )
                            if (x1 > x0 + 1)
                                translate([(x0 + x1) / 2, y_rule, 0])
                                    square([x1 - x0, rule_t], center = true);
                if (t1 != "")
                    linear_extrude(depth)
                        translate([hx1, ys[1], 0])
                            _stamp_text(t1, s1, sc1, f1, h1, sp1);
                if (t2 != "")
                    linear_extrude(depth)
                        translate([hx2, y_text_3, 0])
                            _stamp_text(t2, s2, sc2, f2, h2, sp2);
                if (t3 != "")
                    linear_extrude(depth)
                        let (
                            l4_halign = h3,
                            l1_adv = len(t0) * s0 * kbc_mark_rule_adv_per_char,
                            l4_x = _tx_edge > 0 ? hx3 : (l4_halign == "right" ? l1_adv / 2 : 0)
                        )
                        translate([l4_x, y_text_4, 0])
                            _stamp_text(t3, s3, sc3, f3, l4_halign, sp3);
            }
    }
}
