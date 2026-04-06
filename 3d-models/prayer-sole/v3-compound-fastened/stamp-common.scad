// Product info deboss (lines from stamp-generated.scad; export script writes it).
// Top face: mates against coupler — hidden when assembled.

include <stamp-generated.scad>

kbc_info_stamp_depth = 0.5;

kbc_mark_size = 5;
kbc_mark_size_secondary = 3.5;
kbc_mark_size_tertiary = 3.2;
kbc_mark_gap_2_3 = kbc_mark_size_secondary * 1.25;
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
// Per-line overrides (custom treads can redefine these after include).
info_stamp_line1_size = kbc_mark_size;
info_stamp_line1_rule = true;
info_stamp_gap_1_2 = kbc_mark_gap_1_2;
info_stamp_line4_halign = "center";

// Deboss on the top flat (z = z_top), read from above into the coupler socket.
module part_top_info_stamp_deboss(enable, z_top, radial_ref) {
    depth = kbc_info_stamp_depth + 0.02;
    y1 = info_stamp_gap_1_2;
    y2 = 0;
    y3 = -kbc_mark_gap_2_3;
    y4 = y3 - kbc_mark_gap_2_3;
    ys = [y1, y2, y3, y4];
    // When line 2 is empty, pull lines 3–4 up into those slots so the block stays tight.
    use_line2 = info_stamp_line2 != "";
    y_text_3 = use_line2 ? ys[2] : ys[1];
    y_text_4 = use_line2 ? ys[3] : ys[2];
    stamp_shift_y = radial_ref * kbc_mark_radial_shift_fraction;
    // Vertical center of line stack (glyph centers ± half-em); shifts block so midline sits at Y=0 before radial nudge.
    stamp_bbox_top =
        (info_stamp_line1 != "") ? (y1 + info_stamp_line1_size / 2)
        : (info_stamp_line2 != "") ? (y2 + kbc_mark_size_secondary / 2)
        : (info_stamp_line3 != "") ? (y_text_3 + kbc_mark_size_secondary / 2)
        : (y_text_4 + kbc_mark_size_tertiary / 2);
    stamp_bbox_bot =
        (info_stamp_line4 != "") ? (y_text_4 - kbc_mark_size_tertiary / 2)
        : (info_stamp_line3 != "") ? (y_text_3 - kbc_mark_size_secondary / 2)
        : (info_stamp_line2 != "") ? (y2 - kbc_mark_size_secondary / 2)
        : (y1 - info_stamp_line1_size / 2);
    stamp_vertical_center_adj = -(stamp_bbox_top + stamp_bbox_bot) / 2;
    has_any = info_stamp_line1 != "" || info_stamp_line2 != "" || info_stamp_line3 != "" || info_stamp_line4 != "";
    if (enable && has_any) {
        translate([0, stamp_shift_y, z_top + 0.01])
            rotate([180, 0, 0])
            mirror([1, 0, 0])
            translate([0, stamp_vertical_center_adj, 0]) {
                if (info_stamp_line1 != "")
                    linear_extrude(depth)
                        translate([0, ys[0], 0])
                            text(info_stamp_line1,
                                 size = info_stamp_line1_size,
                                 font = kbc_mark_font,
                                 halign = "center",
                                 valign = "center");
                if (info_stamp_line1_rule && info_stamp_line1 != "" && (info_stamp_line2 != "" || info_stamp_line3 != ""))
                    linear_extrude(depth)
                        let (
                            nch = max(len(info_stamp_line1), 1),
                            adv = len(info_stamp_line1) * kbc_mark_size *
                                kbc_mark_rule_adv_per_char,
                            cw = adv / nch,
                            rule_t = max(0.28, kbc_mark_size * kbc_mark_rule_stroke_scale),
                            x0 = -adv / 2,
                            x1 = adv / 2 - cw * kbc_mark_rule_right_inset,
                            line1_bottom_y = y1 - kbc_mark_size * kbc_mark_rule_line1_descender_factor,
                            y_rule = line1_bottom_y - rule_t / 2
                        )
                            if (x1 > x0 + 1)
                                translate([(x0 + x1) / 2, y_rule, 0])
                                    square([x1 - x0, rule_t], center = true);
                if (info_stamp_line2 != "")
                    linear_extrude(depth)
                        translate([0, ys[1], 0])
                            text(info_stamp_line2,
                                 size = kbc_mark_size_secondary,
                                 font = kbc_mark_font,
                                 halign = "center",
                                 valign = "center");
                if (info_stamp_line3 != "")
                    linear_extrude(depth)
                        translate([0, y_text_3, 0])
                            text(info_stamp_line3,
                                 size = kbc_mark_size_secondary,
                                 font = kbc_mark_font,
                                 halign = "center",
                                 valign = "center");
                if (info_stamp_line4 != "")
                    linear_extrude(depth)
                        let (
                            l4_halign = info_stamp_line4_halign,
                            l1_adv = len(info_stamp_line1) * kbc_mark_size *
                                     kbc_mark_rule_adv_per_char,
                            l4_x = l4_halign == "right" ? l1_adv / 2 : 0
                        )
                        translate([l4_x, y_text_4, 0])
                            text(info_stamp_line4,
                                 size = kbc_mark_size_tertiary,
                                 font = kbc_mark_font,
                                 halign = l4_halign,
                                 valign = "center");
            }
    }
}
