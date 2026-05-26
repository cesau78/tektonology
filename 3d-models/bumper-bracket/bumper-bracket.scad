// Bumper bracket body: shell rectangular core + shell_wedge on insertion roof.
// Drawn in bracket coordinates (see config.scad). No rotate() reorients the bracket body.

include <config.scad>

bumper_emit_if_root_scad_tree = is_undef(render_standalone_export) ? true : render_standalone_export;

$fn = preview ? 32 : 64;

module shell_wedge_primitive(overlap_below = corner_r) {
    Dc = shell_inset_dim_tread_pew_mm;
    run = shell_inset_dim_qr_wedge_mm;
    Zr = shell_wedge_leg_mm;
    H = shell_height_mm;
    bx = corner_r;
    by = corner_r;
    xr = bx + run;

    overlap_c = bracket_pos(bx + run / 2, by + Dc / 2, H - overlap_below / 2);
    translate(overlap_c)
        cube([run, overlap_below, Dc], center = true);

    polyhedron(
        points = [
            bracket_pos(bx, by, H),
            bracket_pos(xr, by, H),
            bracket_pos(xr, by, H + Zr),
            bracket_pos(bx, by + Dc, H),
            bracket_pos(xr, by + Dc, H),
            bracket_pos(xr, by + Dc, H + Zr),
        ],
        faces = [
            [0, 1, 4, 3],
            [1, 2, 5, 4],
            [0, 3, 5, 2],
            [0, 2, 1],
            [3, 4, 5],
        ],
        convexity = 4
    );
}

function bracket_world_z_min() = bracket_face_tread_slot_z_mm;

// Export-only Z translate (not a design-frame rotation).
module bracket_export_bed_lift() {
    if (bracket_lift_to_bed)
        translate([0, 0, -bracket_world_z_min()])
            children();
    else
        children();
}

function exploded_tread_offset_vec() = [
    exploded_tread_offset_pull[0],
    exploded_tread_offset_pull[1] + assembly_tread_vertical_auto_mm() + assembly_tread_z_trim_mm,
    exploded_tread_offset_pull[2],
];

function _bracket_cross_half_extent() =
    max(
        shell_extent_qr_wedge_mm,
        shell_extent_tread_pew_mm,
        shell_height_mm + shell_wedge_leg_mm
    ) * 2 + 40;

module _bracket_cross_half_space_positive() {
    h = _bracket_cross_half_extent();
    pos =
        (bracket_cross_axis == "x" ? 0
        : bracket_cross_axis == "y" ? shell_midplane_y_mm
        : 0) + bracket_cross_offset;
    if (bracket_cross_axis == "x")
        translate([pos, -h, -h])
            cube([2 * h, 2 * h, 2 * h]);
    else if (bracket_cross_axis == "y")
        translate([-h, pos, -h])
            cube([2 * h, 2 * h, 2 * h]);
    else
        translate([-h, -h, pos])
            cube([2 * h, 2 * h, 2 * h]);
}

module bracket_cross_trim() {
    if (!bracket_cross_section) {
        children();
    } else {
        intersection() {
            union() {
                children();
            }
            _bracket_cross_half_space_positive();
        }
    }
}

// Full exterior rule box (lx × lz × ly → bracket x, y, z).
module shell_envelope_solid_rule_box() {
    translate(bracket_pos(
        shell_extent_qr_wedge_mm / 2,
        shell_extent_tread_pew_mm / 2,
        shell_height_mm / 2))
        cube(
            [shell_extent_qr_wedge_mm, shell_height_mm, shell_extent_tread_pew_mm],
            center = true
        );
}

module shell_envelope_minkowski_union() {
    if (shell_use_simple_rule_box) {
        shell_envelope_solid_rule_box();
    } else {
        core_leg = [
            shell_extent_qr_wedge_mm - 2 * corner_r,
            shell_extent_tread_pew_mm - 2 * corner_r,
            shell_height_mm - corner_r,
        ];
        sz = [core_leg[0], core_leg[2], core_leg[1]];
        c = bracket_pos(
            corner_r + core_leg[0] / 2,
            corner_r + core_leg[1] / 2,
            corner_r + core_leg[2] / 2
        );
        minkowski() {
            union() {
                translate(c)
                    cube(sz, center = true);
                if (shell_roof_prism_enabled)
                    shell_wedge_primitive();
            }
            sphere(r = corner_r, $fn = preview ? 16 : 24);
        }
    }
}

// Side D (−Z tread) narrows 12.8 mm along +Y at E; D∩F stays 90°; D∩E = 90° + tread_face_de_extra_angle_deg.
// Material removed from face E only: 0 at C∩E, tread_face_d_e_side_y_narrow_mm at D∩E (depth taken from D side), full ±X span. F + prism unchanged.
module shell_tread_face_de_bevel_cut() {
    z_d = bracket_face_tread_slot_z_mm;
    z_c = bracket_face_pew_z_mm;
    z_span = z_c - z_d;
    y_e = bracket_nat_y_mid_mm;
    y_hi = y_e + shell_wedge_leg_mm + 40;
    x_h = shell_extent_qr_wedge_mm / 2 + shell_wedge_leg_mm + 20;

    function y_cut(z) = y_e - tread_face_e_bevel_slope_k() * (z_c - z);

    y_d = y_cut(z_d);
    y_c = y_cut(z_c);

    polyhedron(
        points = [
            [-x_h, y_hi, z_d],
            [x_h, y_hi, z_d],
            [-x_h, y_hi, z_c],
            [x_h, y_hi, z_c],
            [-x_h, y_d, z_d],
            [x_h, y_d, z_d],
            [-x_h, y_c, z_c],
            [x_h, y_c, z_c],
        ],
        faces = [
            [0, 1, 3, 2],
            [4, 5, 7, 6],
            [0, 4, 5, 1],
            [2, 3, 7, 6],
            [0, 2, 6, 4],
            [1, 5, 7, 3],
        ],
        convexity = 2
    );
}

function hyp_z_at_x(x) =
    shell_wedge_leg_mm * (x - corner_r) / shell_wedge_hypotenuse_run_mm;

module wood_mount_hole(y_frac) {
    xw = corner_r + shell_wedge_hypotenuse_run_mm / 2;
    zw = shell_height_mm + hyp_z_at_x(xw);
    y_w = corner_r + shell_inset_dim_tread_pew_mm * y_frac;
    psi_deg = atan2(shell_wedge_leg_mm, shell_wedge_hypotenuse_run_mm);
    half = wood_bored_axial_mm / 2;
    $fn = preview ? 28 : 64;

    // Bore axis in bracket X–Y (slant plane); local rotate only — bracket frame unchanged.
    translate(bracket_pos(xw, y_w, zw))
        rotate([0, 0, -psi_deg])
            rotate([90, 0, 0])
                union() {
                    cylinder(h = wood_bored_axial_mm, d = wood_shank_clr, center = true);
                    translate([0, 0, -half - wood_countersink_depth_mm - epsilon])
                        cylinder(
                            h = wood_countersink_depth_mm + epsilon * 3,
                            r1 = wood_head_diameter / 2 + screw_chamfer_lip_mm,
                            r2 = wood_shank_clr / 2 + epsilon,
                            center = false
                        );
                }
}

module wood_screw_pattern() {
    for (yf = hole_y_frac)
        wood_mount_hole(yf);
}

// Pocket in bracket [x,y,z]: sloped ceiling; floor parallel below by depth_y. ceiling_drop_mm lowers ceiling below y_cut (core under flange).
// Span along bracket Z (tread face D through pew); breaks past D when ly_center includes tread-face break.
module shell_tread_pocket_cutter_to_e(
    lx_center,
    ly_center,
    lz_center,
    pocket_w,
    pocket_h_lz,
    pocket_len_ly,
    ceiling_drop_mm = 0
) {
    z_c = bracket_face_pew_z_mm;
    z_d = bracket_face_tread_slot_z_mm;
    y_e = bracket_nat_y_mid_mm;
    k = tread_face_e_bevel_slope_k();
    depth_y = pocket_h_lz;

    function y_cut(z) = y_e - k * (z_c - z);
    function y_ceiling(z) = y_cut(z) - ceiling_drop_mm;
    function y_floor_at(z) = y_ceiling(z) - depth_y;

    ly_lo = ly_center - pocket_len_ly / 2;
    ly_hi = ly_center + pocket_len_ly / 2;
    z_lo = min(ly_lo - shell_extent_tread_pew_mm / 2, z_d - epsilon * 4);
    z_hi = ly_hi - shell_extent_tread_pew_mm / 2;

    x_lo = lx_center - shell_extent_qr_wedge_mm / 2 - pocket_w / 2;
    x_hi = x_lo + pocket_w;
    pad = epsilon * 4;

    y_e_lo = y_ceiling(z_lo) - epsilon;
    y_e_hi = y_ceiling(z_hi) - epsilon;
    y_f_lo = y_floor_at(z_lo) - pad;
    y_f_hi = y_floor_at(z_hi) - pad;

    polyhedron(
        points = [
            [x_lo - pad, y_f_lo, z_lo - pad],
            [x_hi + pad, y_f_lo, z_lo - pad],
            [x_lo - pad, y_f_hi, z_hi + pad],
            [x_hi + pad, y_f_hi, z_hi + pad],
            [x_lo - pad, y_e_lo, z_lo - pad],
            [x_hi + pad, y_e_lo, z_lo - pad],
            [x_lo - pad, y_e_hi, z_hi + pad],
            [x_hi + pad, y_e_hi, z_hi + pad],
        ],
        faces = [
            [0, 1, 3, 2],
            [4, 5, 7, 6],
            [0, 4, 5, 1],
            [2, 3, 7, 6],
            [0, 2, 6, 4],
            [1, 5, 7, 3],
        ],
        convexity = 2
    );
}

module shell_tread_groove_pocket_cube() {
    margin_x = (shell_extent_qr_wedge_mm - groove_w) / 2;
    x_hi = shell_extent_qr_wedge_mm - margin_x;
    x_lo = x_hi - groove_w;
    y_br = tread_groove_pocket_break_tread_face_mm;
    y_len = tread_groove_pocket_inward_y_mm + y_br;
    zh = tread_groove_pocket_height_mm + epsilon * 4;
    core_zh = tread_core_pocket_depth_z_mm + epsilon * 4;
    // Flange groove (wider): behind tread core, toward F — not flush with E.
    shell_tread_pocket_cutter_to_e(
        (x_lo + x_hi) / 2,
        -y_br + y_len / 2,
        tread_groove_pocket_z0_mm + zh / 2,
        groove_w,
        zh,
        y_len,
        core_zh
    );
}

module shell_tread_core_pocket_cube() {
    margin_x = (shell_extent_qr_wedge_mm - tread_w) / 2;
    x_hi = shell_extent_qr_wedge_mm - margin_x;
    x_lo = x_hi - tread_w;
    y_br = tread_groove_pocket_break_tread_face_mm;
    y_len = tread_core_pocket_inward_y_mm + y_br;
    zh = tread_core_pocket_depth_z_mm + epsilon * 4;
    // Tread rigid core (narrower): ceiling flush on tapered E (y_cut).
    shell_tread_pocket_cutter_to_e(
        (x_lo + x_hi) / 2,
        -y_br + y_len / 2,
        tread_core_pocket_floor_z_mm + zh / 2,
        tread_w,
        zh,
        y_len,
        0
    );
}

module shell_body_difference_wedge_bores() {
    difference() {
        shell_envelope_minkowski_union();
        shell_tread_face_de_bevel_cut();
        if (tread_groove_shell_pocket_enabled)
            shell_tread_groove_pocket_cube();
        if (tread_core_shell_pocket_enabled)
            shell_tread_core_pocket_cube();
        if (wood_screw_holes_enabled)
            wood_screw_pattern();
    }
}

module bumper_bracket() {
    bracket_export_bed_lift()
        bracket_cross_trim() {
            shell_body_difference_wedge_bores();
            bumper_bracket_debug_face_labels();
        }
}

module _bumper_debug_label_plate() {
    cube([bumper_bracket_debug_label_plate_mm, bumper_bracket_debug_label_plate_mm, 0.6], center = true);
}

module _bumper_debug_label_glyph(letter, plate_color, text_color) {
    color(plate_color)
        _bumper_debug_label_plate();
    color(text_color)
        linear_extrude(bumper_bracket_debug_label_thickness_mm)
            offset(delta = 0.6, chamfer = 0.3)
                text(
                    letter,
                    size = bumper_bracket_debug_label_size_mm,
                    font = bumper_bracket_debug_label_font,
                    halign = "center",
                    valign = "center"
                );
}

// Bracket-frame labels (assembly preview only; not in STL export root).
module bumper_bracket_debug_face_labels() {
    if (bumper_bracket_debug_face_labels_enabled) {
        off = bumper_bracket_debug_label_offset_mm;
        y_mid = shell_midplane_y_mm;
        x_out = bracket_face_wedge_x_mm + off;
        x_in = -bracket_face_wedge_x_mm - off;
        z_pew = bracket_face_pew_z_mm + off;
        z_tread = bracket_face_tread_slot_z_mm - off;
        y_base = bracket_nat_y_mid_mm - corner_r + off;
        y_roof_out = bracket_nat_y_mid_mm - shell_height_mm - shell_wedge_leg_mm - off
            - bumper_bracket_debug_label_thickness_mm;
        translate([x_out, y_mid, 0])
            rotate([0, 90, 0])
                _bumper_debug_label_glyph("A", [1, 0.2, 0.2], [1, 1, 1]);
        translate([x_in, y_mid, 0])
            rotate([0, -90, 0])
                _bumper_debug_label_glyph("B", [0.2, 1, 0.2], [0, 0, 0]);
        translate([0, y_mid, z_pew])
            rotate([-90, 0, 0])
                _bumper_debug_label_glyph("C", [0.2, 0.4, 1], [1, 1, 1]);
        translate([0, y_mid, z_tread])
            rotate([90, 0, 0])
                _bumper_debug_label_glyph("D", [0.9, 0.85, 0.1], [0, 0, 0]);
        translate([0, y_base, 0])
            rotate([-90, 0, 0])
                _bumper_debug_label_glyph("E", [0.2, 0.85, 0.4], [1, 1, 1]);
        translate([0, y_roof_out, 0])
            rotate([90, 0, 0])
                _bumper_debug_label_glyph("F", [0.6, 0.2, 0.8], [1, 1, 1]);
    }
}

if (bumper_emit_if_root_scad_tree)
    bumper_bracket();
