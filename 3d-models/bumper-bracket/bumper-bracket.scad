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

// Solid rule cube minus three rectangular hull(CUBE) cutters on the 9.8° E-bevel plane (no polyhedron).
HULL_VERTEX_CUBE_MM = 0.5;

function y_on_e_bevel_plane(z) =
    bracket_nat_y_mid_mm - tread_face_e_bevel_slope_k() * (bracket_face_pew_z_mm - z);

// Frustum with sloped top/bottom at y_top(z) and y_bot(z); sides vertical in Y (parallel to bevel normal stack).
module hull_rect_on_e_slope(x_lo, x_hi, z_lo, z_hi, y_top_lo, y_top_hi, y_bot_lo, y_bot_hi) {
    c = HULL_VERTEX_CUBE_MM;
    hull() {
        for (p = [
            [x_lo, y_bot_lo, z_lo],
            [x_hi, y_bot_lo, z_lo],
            [x_lo, y_bot_hi, z_hi],
            [x_hi, y_bot_hi, z_hi],
            [x_lo, y_top_lo, z_lo],
            [x_hi, y_top_lo, z_lo],
            [x_lo, y_top_hi, z_hi],
            [x_hi, y_top_hi, z_hi],
        ])
            translate(p)
                cube(c, center = true);
    }
}

// Cutter 1: E-bevel wedge above y_on_e_bevel_plane (0 at C∩E, tread_face_d_e_side_y_narrow_mm at D∩E).
module shell_tread_face_de_bevel_cut() {
    z_d = bracket_face_tread_slot_z_mm;
    z_c = bracket_face_pew_z_mm;
    y_e = bracket_nat_y_mid_mm;
    y_hi = y_e + shell_wedge_leg_mm + 40;
    x_h = shell_extent_qr_wedge_mm / 2 + shell_wedge_leg_mm + 20;

    hull_rect_on_e_slope(
        -x_h,
        x_h,
        z_d,
        z_c,
        y_hi,
        y_hi,
        y_on_e_bevel_plane(z_d),
        y_on_e_bevel_plane(z_c)
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

// Cutter 2/3: rectangular pocket; ceiling on y_on_e_bevel_plane − ceiling_drop; floor parallel below by depth_y.
module shell_tread_pocket_sloped_hull(lx_center, ly_center, pocket_w, pocket_len_ly, depth_y, ceiling_drop_mm) {
    z_d = bracket_face_tread_slot_z_mm;
    ly_lo = ly_center - pocket_len_ly / 2;
    ly_hi = ly_center + pocket_len_ly / 2;
    z_lo = min(ly_lo - shell_extent_tread_pew_mm / 2, z_d - epsilon * 4);
    z_hi = ly_hi - shell_extent_tread_pew_mm / 2;
    z_pad = epsilon * 4;

    x_lo = lx_center - shell_extent_qr_wedge_mm / 2 - pocket_w / 2;
    x_hi = x_lo + pocket_w;

    y_top_lo = y_on_e_bevel_plane(z_lo) - ceiling_drop_mm - epsilon;
    y_top_hi = y_on_e_bevel_plane(z_hi) - ceiling_drop_mm - epsilon;
    y_bot_lo = y_top_lo - depth_y - z_pad;
    y_bot_hi = y_top_hi - depth_y - z_pad;

    if (z_lo + 0.2 < z_hi && y_top_lo > y_bot_lo + 0.2 && y_top_hi > y_bot_hi + 0.2)
        hull_rect_on_e_slope(
            x_lo,
            x_hi,
            z_lo - z_pad,
            z_hi + z_pad,
            y_top_lo,
            y_top_hi,
            y_bot_lo,
            y_bot_hi
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
    // Cutter 2: flange groove (wider), behind tread core toward F.
    shell_tread_pocket_sloped_hull(
        (x_lo + x_hi) / 2,
        -y_br + y_len / 2,
        groove_w,
        y_len,
        zh,
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
    // Cutter 3: tread core (narrower), ceiling flush on E bevel.
    shell_tread_pocket_sloped_hull(
        (x_lo + x_hi) / 2,
        -y_br + y_len / 2,
        tread_w,
        y_len,
        zh,
        0
    );
}

module shell_body_difference_wedge_bores() {
    // One solid cube minus three sloped rectangular hull cutters (bevel + flange + tread).
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
