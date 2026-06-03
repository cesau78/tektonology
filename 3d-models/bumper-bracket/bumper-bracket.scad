// Bumper bracket body: shell envelope (core + roof wedge + pew pad) pre-mink, then fillet + cutters.
// Drawn in bracket coordinates (see config.scad). No rotate() reorients the bracket body.

include <config.scad>

bumper_emit_if_root_scad_tree = is_undef(render_standalone_export) ? true : render_standalone_export;

$fn = preview ? 32 : 64;

// Core, roof overlap + prism, and pew pad — shared envelope anchors, no per-part minkowski.
module shell_envelope_pre_mink(overlap_below = corner_r) {
    core_c = shell_envelope_core_center_lxlz();
    wedge_xr = shell_envelope_wedge_xr_lx_mm();
    wedge_run = shell_inset_dim_qr_wedge_mm;
    wedge_depth = shell_inset_dim_tread_pew_mm;

    translate(bracket_pos(core_c[0], core_c[1], core_c[2]))
        cube(
            [shell_envelope_core_lx_mm, shell_envelope_core_lz_mm, shell_envelope_core_ly_mm],
            center = true
        );

    translate(bracket_pos(
        shell_envelope_inset_lx_mm + wedge_run / 2,
        shell_envelope_inset_ly_mm + wedge_depth / 2,
        shell_envelope_roof_lz_mm - overlap_below / 2
    ))
        cube([wedge_run, overlap_below, wedge_depth], center = true);

    polyhedron(
        points = [
            bracket_pos(shell_envelope_inset_lx_mm, shell_envelope_inset_ly_mm, shell_envelope_roof_lz_mm),
            bracket_pos(wedge_xr, shell_envelope_inset_ly_mm, shell_envelope_roof_lz_mm),
            bracket_pos(wedge_xr, shell_envelope_inset_ly_mm, shell_envelope_apex_lz_mm),
            bracket_pos(shell_envelope_inset_lx_mm, shell_envelope_inset_ly_mm + wedge_depth, shell_envelope_roof_lz_mm),
            bracket_pos(wedge_xr, shell_envelope_inset_ly_mm + wedge_depth, shell_envelope_roof_lz_mm),
            bracket_pos(wedge_xr, shell_envelope_inset_ly_mm + wedge_depth, shell_envelope_apex_lz_mm),
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

    if (pew_mount_block_enabled && pew_mount_block_y_len_mm > 0.2)
        translate([
            pew_mount_block_x_center_mm(),
            pew_mount_block_y_center_mm(),
            pew_mount_block_z_center_mm(),
        ])
            cube(
                [
                    pew_mount_block_thickness_x_mm,
                    pew_mount_block_y_len_mm,
                    pew_mount_block_z_len_mm(),
                ],
                center = true
            );

    // Reinforcement welded to the block's −X side: full block Z height, from the
    // roof-wedge start out to the block's +Y front face. A pre-mink primitive so
    // it rounds and welds flush; the hull cuts below still carve it consistently.
    if (pew_mount_reinforce_enabled && pew_mount_block_enabled && pew_mount_block_y_len_mm > 0.2) {
        rx_hi = pew_mount_block_x_center_mm() - pew_mount_block_thickness_x_mm / 2;
        rx_lo = rx_hi - pew_mount_reinforce_depth_x_mm;
        ry_lo = bracket_nat_y_mid_mm - shell_height_mm;   // roof-wedge start (core/wedge seam)
        ry_hi = pew_mount_block_y_hi_mm();                // flush with the block's +Y front face
        translate([
            (rx_lo + rx_hi) / 2,
            (ry_lo + ry_hi) / 2,
            pew_mount_block_z_center_mm(),
        ])
            cube(
                [rx_hi - rx_lo, ry_hi - ry_lo, pew_mount_block_z_len_mm()],
                center = true
            );
    }
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

// One minkowski fillet over the pre-mink envelope union (tread ghost uses its own minkowski separately).
module shell_envelope_minkowski_union() {
    minkowski() {
        shell_envelope_pre_mink();
        sphere(r = corner_r, $fn = preview ? 16 : 24);
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

    // When the pew mount block extends in +Y past the E-bevel plane, stop the
    // bevel cutter at the block's −X face so the angled top sits flush against
    // the block's side wall instead of slicing diagonally through the cube. If
    // the −X reinforcement is present, stop at its −X face so it stays flush too.
    block_minus_x = pew_mount_block_x_center_mm() - pew_mount_block_thickness_x_mm / 2;
    flush_x = (pew_mount_reinforce_enabled && pew_mount_block_enabled && pew_mount_block_y_len_mm > 0.2)
        ? block_minus_x - pew_mount_reinforce_depth_x_mm
        : block_minus_x;
    x_hi = (pew_mount_block_enabled && pew_mount_block_y_len_mm > 0.2)
        ? flush_x
        : x_h;

    hull_rect_on_e_slope(
        -x_h,
        x_hi,
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
    psi_deg = atan2(shell_wedge_leg_mm, shell_wedge_hypotenuse_run_mm);
    half = wood_bored_axial_mm / 2;
    csink_h = wood_countersink_depth_mm + epsilon * 3;
    $fn = preview ? 28 : 64;

    // rotate([-90,0,0]): local +Z = hypotenuse outward normal (leg, run) in bracket X–Y.
    // Anchor on minkowski exterior; shank centered through part; countersink wide at wedge face.
    translate(wood_screw_hole_exterior_bracket_pos(y_frac))
        rotate([0, 0, -psi_deg])
            rotate([-90, 0, 0])
                union() {
                    cylinder(h = wood_bored_axial_mm, d = wood_shank_clr, center = true);
                    // Head recess: wide at z = 0 (exterior), tapers inward along −Z.
                    translate([0, 0, -csink_h])
                        cylinder(
                            h = csink_h,
                            r1 = wood_head_diameter / 2 + screw_chamfer_lip_mm,
                            r2 = wood_shank_clr / 2 + epsilon,
                            center = false
                        );
                }
}

module wood_screw_pattern() {
    for (yf = wood_screw_hole_y_fractions)
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

    // tread_slot_face_offset_mm pushes every tread pocket −Y off the +Y base face.
    y_top_lo = y_on_e_bevel_plane(z_lo) - ceiling_drop_mm - tread_slot_face_offset_mm - epsilon;
    y_top_hi = y_on_e_bevel_plane(z_hi) - ceiling_drop_mm - tread_slot_face_offset_mm - epsilon;
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

// ceiling_drop_mm = 0 → ceiling flush on E bevel (tread 1, near side). A positive
// drop sinks the pocket past the flange groove for the back-to-back tread (tread 2).
// depth_z_mm sets how far the pocket runs along the bevel normal (the tread height
// proud of the flange); the buried inner tread needs more than the outer one.
module shell_tread_core_pocket_cube(ceiling_drop_mm = 0, depth_z_mm = tread_core_pocket_depth_z_mm) {
    margin_x = (shell_extent_qr_wedge_mm - tread_w) / 2;
    x_hi = shell_extent_qr_wedge_mm - margin_x;
    x_lo = x_hi - tread_w;
    y_br = tread_groove_pocket_break_tread_face_mm;
    y_len = tread_core_pocket_inward_y_mm + y_br;
    zh = depth_z_mm + epsilon * 4;
    // Cutter 3: tread core (narrower), ceiling flush on E bevel (or dropped for tread 2).
    shell_tread_pocket_sloped_hull(
        (x_lo + x_hi) / 2,
        -y_br + y_len / 2,
        tread_w,
        y_len,
        zh,
        ceiling_drop_mm
    );
}

// ── Tread retention cap fastener (body side) ────────────────────────────────
// Bolt channel: shaft bore running +Z from the mouth past the nut, on the
// central axis just behind the inner tread.
module tread_cap_bolt_channel() {
    d = cap_bolt_dia + cap_bolt_clearance;
    z0 = tread_cap_mouth_z_mm() - epsilon * 4;
    z1 = cap_bolt_tip_z_mm() + 0.5;
    translate([cap_bolt_x_mm, cap_bolt_y_mm(), z0])
        cylinder(h = z1 - z0, d = d, $fn = preview ? 24 : 48);
}

// Hex nut seat — axis along Z (coaxial with the bolt); flats face ±X so the nut
// slides in along +Y (from the tread cavity) and keys against rotation. The seat
// is cap_nut_pocket_z_extra taller than the slide-in slot on each Z face, so its
// top/bottom shoulders trap the nut once seated (prayer-sole collar pattern).
module tread_cap_nut_pocket() {
    nut_r = (cap_nut_af + cap_nut_clearance) / 2 / cos(30);
    h = cap_nut_pocket_z_height_mm();
    translate([cap_bolt_x_mm, cap_bolt_y_mm(), cap_nut_center_z_mm() - h / 2])
        rotate([0, 0, 30])
            cylinder(h = h, r = nut_r, $fn = 6);
}

// Nut slide-in slot — channel running +Y from the hex seat up into the tread-slot
// cavity (behind the inner tread). The nut drops in through the slot and slides −Y
// to seat; no exterior bracket face is broken. Its Z height is just the nut
// thickness + clearance (shorter than the seat), so the nut can't flop in the
// channel and the taller seat's shoulders retain it at the end.
module tread_cap_nut_slot() {
    w = cap_nut_af + cap_nut_clearance;   // X width (across flats; keys rotation)
    h = cap_nut_slot_z_height_mm();       // Z height (nut thickness + clearance, no seat extra)
    y_start = cap_bolt_y_mm();
    y_end = cap_nut_slot_exit_y_mm();
    len = abs(y_end - y_start);
    translate([cap_bolt_x_mm - w / 2, min(y_start, y_end), cap_nut_center_z_mm() - h / 2])
        cube([w, len, h]);
}

// Cap recess ("cube hull"): a rectangular pocket in the −Z mouth, below the
// seated treads, that the flush cap plugs into. Cut from the body at inset = 0;
// the cap is built from the same volume shrunk by the fit clearance. The −Z face
// runs proud of the mouth and the top runs above E (the bevel/envelope clip the
// real faces), so only the −Y floor (wedge start), ±X sides, and +Z face matter.
module tread_cap_recess_volume(inset = 0) {
    x_lo = -tread_cap_recess_x_half_mm() + inset;
    x_hi =  tread_cap_recess_x_half_mm() - inset;
    y_lo = tread_cap_recess_y_lo_mm() + inset;
    y_hi = tread_cap_recess_y_hi_mm();
    z_lo = tread_cap_recess_z_lo_mm() - epsilon * 4;
    z_hi = tread_cap_recess_z_hi_mm() - inset;
    translate([x_lo, y_lo, z_lo])
        cube([x_hi - x_lo, y_hi - y_lo, z_hi - z_lo]);
}

// Body envelope with the E-bevel only (no tread pockets) — used to carve the cap
// so the plug is solid across the slot opening (stops the treads) yet still
// follows the bracket's beveled top and rounded mouth faces.
module shell_solid_no_tread_pockets() {
    difference() {
        shell_envelope_minkowski_union();
        shell_tread_face_de_bevel_cut();
    }
}

module tread_cap_fastener_cuts() {
    if (tread_cap_enabled) {
        tread_cap_bolt_channel();
        tread_cap_nut_pocket();
        tread_cap_nut_slot();
    }
}

// Preview hardware (assembly only): silver bolt seated in the cap + green nut.
module tread_cap_hardware_debug() {
    head_top_z = tread_cap_outer_z_mm();
    color("silver", 0.85) {
        translate([cap_bolt_x_mm, cap_bolt_y_mm(), head_top_z])
            cylinder(h = cap_head_height, d = cap_head_dia, $fn = 40);
        translate([cap_bolt_x_mm, cap_bolt_y_mm(), cap_bolt_head_end_z_mm()])
            cylinder(h = cap_bolt_length, d = cap_bolt_dia, $fn = 28);
    }
    nut_r = cap_nut_af / 2 / cos(30);
    color("green", 0.7)
        translate([cap_bolt_x_mm, cap_bolt_y_mm(), cap_nut_center_z_mm() - cap_nut_thickness / 2])
            rotate([0, 0, 30])
                cylinder(h = cap_nut_thickness, r = nut_r, $fn = 6);
}

// Shallow rounded-square recess on the mount block's +Y front face to seat a 1"
// QR-code sticker flush. Cuts qr_pocket_depth_mm inward (−Y), centered on that
// face (offsets nudge it along bracket X and Z).
module qr_sticker_pocket() {
    s = qr_pocket_size_mm;
    r = min(qr_pocket_corner_r_mm, s / 2 - 0.01);
    half = s / 2 - r;
    y_face = pew_mount_block_y_hi_mm() + corner_r;   // +Y front face (incl. minkowski skin)
    // Center on the full front face (block + flush −X reinforcement) so a 1" tile fits.
    face_x_hi = pew_mount_block_x_center_mm() + pew_mount_block_thickness_x_mm / 2;
    face_x_lo = pew_mount_block_x_center_mm() - pew_mount_block_thickness_x_mm / 2
        - (pew_mount_reinforce_enabled ? pew_mount_reinforce_depth_x_mm : 0);
    xc = (face_x_lo + face_x_hi) / 2 + qr_pocket_x_offset_mm;
    zc = pew_mount_block_z_center_mm() + qr_pocket_z_offset_mm;
    translate([xc, y_face + epsilon, zc])
        rotate([90, 0, 0])   // extrude axis (+Z local) → bracket −Y (into the part)
            linear_extrude(qr_pocket_depth_mm + epsilon)
                hull()
                    for (a = [-1, 1], b = [-1, 1])
                        translate([a * half, b * half])
                            circle(r = r, $fn = preview ? 16 : 32);
}

// Vertical pocket ("cube hull") in the +X (pew-leg) face of the mount block.
// Opens on +X (overshoots the minkowski skin), runs depth_x in −X, and spans
// the block's full Z length (overshoots both Z ends). The +Y window is taken
// from the block's roof-side (−Y) end.
module pew_mount_block_pocket_cut() {
    x_face = pew_mount_block_face_x_mm();
    x_hi = x_face + corner_r + epsilon * 4;            // clear the rounded exterior
    x_lo = x_face - pew_mount_block_pocket_depth_x_mm;
    y_lo = pew_mount_block_pocket_y_lo_mm();
    y_hi = pew_mount_block_pocket_y_hi_mm();
    z_half = pew_mount_block_z_len_mm() / 2 + corner_r + epsilon * 4;
    z_lo = pew_mount_block_z_center_mm() - z_half;
    z_hi = pew_mount_block_z_center_mm() + z_half;
    translate([x_lo, y_lo, z_lo])
        cube([x_hi - x_lo, y_hi - y_lo, z_hi - z_lo]);
}

module shell_body_difference_wedge_bores() {
    // Filleted core+prism+mount pad minus three sloped hull cutters (bevel + flange + tread).
    difference() {
        shell_envelope_minkowski_union();
        shell_tread_face_de_bevel_cut();
        if (tread_groove_shell_pocket_enabled)
            shell_tread_groove_pocket_cube();
        if (tread_core_shell_pocket_enabled)
            shell_tread_core_pocket_cube();
        if (tread_core_shell_pocket_2_enabled)
            shell_tread_core_pocket_cube(
                tread_core_pocket_2_ceiling_drop_mm,
                tread_core_pocket_2_depth_z_mm
            );
        if (wood_screw_holes_enabled)
            wood_screw_pattern();
        if (tread_cap_enabled)
            tread_cap_recess_volume();
        tread_cap_fastener_cuts();
        if (qr_pocket_enabled)
            qr_sticker_pocket();
        if (pew_mount_block_pocket_enabled && pew_mount_block_enabled && pew_mount_block_y_len_mm > 0.2)
            pew_mount_block_pocket_cut();
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
