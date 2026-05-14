// Bumper bracket body: shell rectangular core + shell_wedge on insertion roof (see config canonical faces).
// Respect bracket_rotate_x_deg; keep bracket_cross_section = false for STL export.
// Assembly preview sets `render_standalone_export = false` before `include`; this file reads it only and never overwrites it (avoids OpenSCAD “assigned but overwritten” warning).

include <config.scad>

// True when rendering this tree as STL root; false when pulled in via assembly.scad.
bumper_emit_if_root_scad_tree = is_undef(render_standalone_export) ? true : render_standalone_export;

$fn = preview ? 32 : 64;

// shell_wedge: triangular prism + overlap slab on shell_face_insertion_roof (+Z).
// Apex +X at xr matches inset shell rim; outer vertical patch is shell_face_wedge_outer (+X).
module shell_wedge_primitive(overlap_below = corner_r) {
    bx = corner_r;
    by = corner_r;
    Dc = shell_inset_dim_tread_pew_mm;
    xr = bx + shell_inset_dim_qr_wedge_mm;
    Zr = shell_wedge_leg_mm;

    translate([bx, by, -overlap_below])
        cube([shell_inset_dim_qr_wedge_mm, Dc, overlap_below]);

    polyhedron(
        points = [
            [bx, by, 0],       // 0 lf roof
            [xr, by, 0],       // 1 rf roof / +X rim
            [xr, by, Zr],      // 2 apex −Y patch
            [bx, by + Dc, 0],  // 3 lf roof (+Y)
            [xr, by + Dc, 0],  // 4 rf roof (+Y)
            [xr, by + Dc, Zr], // 5 apex +Y patch
        ],
        faces = [
            [0, 1, 4, 3],       // footprint on shell_face_insertion_roof
            [1, 2, 5, 4],       // shell_face_wedge_outer (+X vertical façade at x = xr)
            [0, 3, 5, 2],       // hypotenuse (single sloped face)
            [0, 2, 1],          // small end triangle y = by
            [3, 4, 5],          // small end triangle y = by + Dc
        ],
        convexity = 4
    );
}

// Smallest world Z after Rx(bracket_rotate_x_deg) about pivot (shell_extent_* midplanes on XY); bbox corners only.
function bracket_world_z_min_after_rotate(rx_deg) = let (
    py = shell_extent_tread_pew_mm / 2,
    Ztop = shell_height_mm + shell_wedge_leg_mm + corner_r,
    s = sin(rx_deg),
    c = cos(rx_deg),
    z00 = (0 - py) * s + 0 * c,
    z0t = (0 - py) * s + Ztop * c,
    zd0 = (shell_extent_tread_pew_mm - py) * s + 0 * c,
    zdt = (shell_extent_tread_pew_mm - py) * s + Ztop * c
) min(min(z00, z0t), min(zd0, zdt));

// Rotate whole part in export coordinates (+X RHS rule); pivot = bottom footprint center (XY center on canonical bottom plane).
// Translates along world +Z so the oriented solid’s lowest point sits at Z ≈ 0 (fixes Rx 90° dipping relative to tread–pew span).
module apply_bracket_orientation() {
    px = shell_extent_qr_wedge_mm / 2;
    py = shell_extent_tread_pew_mm / 2;
    pz = 0;
    z_lift = -bracket_world_z_min_after_rotate(bracket_rotate_x_deg);
    translate([0, 0, z_lift])
        translate([px, py, pz])
            rotate([bracket_rotate_x_deg, 0, 0])
                translate([-px, -py, -pz])
                    children();
}

// Pull-apart + vertical alignment along canonical shell_height_mm (+Z): tread VS bracket share same Rx afterward.
function exploded_tread_offset_vec() = let (
    va = assembly_tread_vertical_auto_mm() + assembly_tread_z_trim_mm,
    pull = exploded_tread_offset_pull
) [
    pull[0],
    pull[1],
    pull[2] + va
];


function _bracket_cross_half_extent() =
    max(shell_extent_qr_wedge_mm, shell_extent_tread_pew_mm, shell_height_mm + shell_wedge_leg_mm) * 2 + 40;

// Half-space + intersection (canonical frame only). Match tread.scad: keep axis ≥ bracket_cross_* position.
module _bracket_cross_half_space_positive() {
    h = _bracket_cross_half_extent();
    pos =
        (bracket_cross_axis == "x" ? shell_extent_qr_wedge_mm / 2
        : bracket_cross_axis == "y" ? shell_extent_tread_pew_mm / 2
        : shell_height_mm / 2) + bracket_cross_offset;
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

// Wrap bracket solids for inspection (wedge/screw internals).
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


// shell_inset rectangular core (− wedge) + shell_wedge union, rounded by corner_r minkowski (solid interior).
module shell_envelope_minkowski_union() {
    minkowski() {
        union() {
            translate([corner_r, corner_r, corner_r])
                cube([
                    shell_extent_qr_wedge_mm - 2 * corner_r,
                    shell_extent_tread_pew_mm - 2 * corner_r,
                    shell_height_mm - corner_r,
                ]);
            translate([0, 0, shell_height_mm])
                shell_wedge_primitive();
        }
        sphere(r = corner_r, $fn = preview ? 16 : 24);
    }
}

// Z on sloped prism face (XZ hypotenuse) at given X along roof run (corner_r → wedge rim along +X).
function hyp_z_at_x(x) =
    shell_wedge_leg_mm * (x - corner_r) / shell_wedge_hypotenuse_run_mm;

// Screw bores ⊥ hypotenuse: row at mid **X** on hypotenuse; **Y** along tread↔pew from hole_y_frac; chamfer toward exterior.
module wood_mount_hole(y_frac) {
    xw = corner_r + shell_wedge_hypotenuse_run_mm / 2;
    zw = shell_height_mm + hyp_z_at_x(xw);
    y_w = corner_r + shell_inset_dim_tread_pew_mm * y_frac;
    psi_deg = atan2(shell_wedge_leg_mm, shell_wedge_hypotenuse_run_mm);
    ry_deg = psi_deg + 90;
    half = wood_bored_axial_mm / 2;
    $fn = preview ? 28 : 64;

    translate([xw, y_w, zw])
        rotate([0, ry_deg, 0])
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

// Box void: mouth at shell_face_tread (−Y); inner +Y length = tread_groove_pocket_inward_y_mm from spec (includes break-out through face).
// X: groove_w centered QR↔wedge (toward shell_face_wedge_outer +X) per margin_x formula.
// Y: −tread_groove_pocket_break_tread_face_mm through +tread_groove_pocket_inward_y_mm along +Y.
// Z: floor at tread_groove_pocket_z0_mm (= corner_r + z_above_core floor; see config) through full flange + minkowski height.
module shell_tread_groove_pocket_cube() {
    margin_x = (shell_extent_qr_wedge_mm - groove_w) / 2;
    x_hi = shell_extent_qr_wedge_mm - margin_x;
    x_lo = x_hi - groove_w;
    y_br = tread_groove_pocket_break_tread_face_mm;
    y_len = tread_groove_pocket_inward_y_mm + y_br;
    zh = tread_groove_pocket_height_mm + epsilon * 4;
    translate([x_lo, -y_br, tread_groove_pocket_z0_mm])
        cube([groove_w, y_len, zh]);
}

// Axis-aligned tread core socket; same −Y breakout and inward +Y convention.
// Z: [tread_core_pocket_floor_z_mm, tread_core_pocket_ceiling_z_mm): from −Z breakout at minkowski bottom tangent through flange pocket ceiling (see config).
module shell_tread_core_pocket_cube() {
    margin_x = (shell_extent_qr_wedge_mm - tread_w) / 2;
    x_hi = shell_extent_qr_wedge_mm - margin_x;
    x_lo = x_hi - tread_w;
    y_br = tread_groove_pocket_break_tread_face_mm;
    y_len = tread_core_pocket_inward_y_mm + y_br;
    zh = tread_core_pocket_depth_z_mm + epsilon * 4;
    translate([x_lo, -y_br, tread_core_pocket_floor_z_mm])
        cube([tread_w, y_len, zh]);
}


// ── Assembly.scad tread pose only (flip helper for exploded tread cosmetic) ──
function tread_cutout_flip_pivot_z() = shell_midplane_z_mm;

module apply_tread_cutout_flip() {
    cx = assembly_tread_center_qr_wedge_mm;
    cy = assembly_tread_center_tread_pew_mm;
    pz = tread_cutout_flip_pivot_z();
    translate([cx, cy, pz])
        rotate([180, 0, 0])
            translate([-cx, -cy, -pz])
                children();
}


module shell_body_difference_wedge_bores() {
    difference() {
        shell_envelope_minkowski_union();
        if (tread_groove_shell_pocket_enabled)
            shell_tread_groove_pocket_cube();
        if (tread_core_shell_pocket_enabled)
            shell_tread_core_pocket_cube();
        wood_screw_pattern();
    }
}

module bumper_bracket() {
    apply_bracket_orientation()
        bracket_cross_trim()
            shell_body_difference_wedge_bores();
}

if (bumper_emit_if_root_scad_tree)
    bumper_bracket();
