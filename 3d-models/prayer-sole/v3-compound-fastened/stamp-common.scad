// Product info deboss (lines from stamp-generated.scad; export script writes it).
// Top face: mates against coupler — hidden when assembled.

include <stamp-generated.scad>

kbc_info_stamp_depth = 0.65;

kbc_mark_size = 5;
kbc_mark_size_secondary = 3.5;
kbc_mark_size_tertiary = 3.2;
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
kbc_mark_font = "Liberation Sans:style=Bold";
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
info_stamp_line1_rule = true;
info_stamp_gap_1_2 = kbc_mark_gap_1_2;

// Compact custom layouts: non-empty list switches line source to profile rows (legacy line1..4 ignored for text).
// Each row: [ "text", size, "font", "halign", "valign" ] — omit trailing entries to use defaults (font kbc_mark_font, align center).
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
function stamp_prof_font(row, def) =
    len(row) >= 3 ? row[2] : def;
function stamp_prof_h(row, def) =
    len(row) >= 4 ? row[3] : def;
function stamp_prof_v(row, def) =
    len(row) >= 5 ? row[4] : def;

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

function stamp_legacy_v(i) =
    i == 0 ? info_stamp_line1_valign
    : i == 1 ? info_stamp_line2_valign
    : i == 2 ? info_stamp_line3_valign
    : info_stamp_line4_valign;

function stamp_eff_v(i) =
    stamp_use_profile() && i < len(info_stamp_profile)
        ? stamp_prof_v(info_stamp_profile[i], "center")
        : stamp_legacy_v(i);

// Deboss on the top flat (z = z_top), read from above into the coupler socket.
module part_top_info_stamp_deboss(enable, z_top, radial_ref) {
    depth = kbc_info_stamp_depth + 0.02;
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
    v0 = stamp_eff_v(0);
    v1 = stamp_eff_v(1);
    v2 = stamp_eff_v(2);
    v3 = stamp_eff_v(3);
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
                        translate([0, ys[0], 0])
                            text(t0,
                                 size = s0,
                                 font = f0,
                                 halign = h0,
                                 valign = v0);
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
                        translate([0, ys[1], 0])
                            text(t1, size = s1, font = f1, halign = h1, valign = v1);
                if (t2 != "")
                    linear_extrude(depth)
                        translate([0, y_text_3, 0])
                            text(t2, size = s2, font = f2, halign = h2, valign = v2);
                if (t3 != "")
                    linear_extrude(depth)
                        let (
                            l4_halign = h3,
                            l1_adv = len(t0) * s0 * kbc_mark_rule_adv_per_char,
                            l4_x = l4_halign == "right" ? l1_adv / 2 : 0
                        )
                        translate([l4_x, y_text_4, 0])
                            text(t3, size = s3, font = f3, halign = l4_halign, valign = v3);
            }
    }
}
