// Assembly preview — bumper bracket (native frame) + reference ghosts.
//
// shell_body_difference_wedge_bores() + tread ghost share assembly_bumper_bracket_group().
// Bracket STL body has no rotate() in bumper-bracket.scad; preview tilts/moves the bumper unit only.
// Kneeler stack uses assembly_kneeler_pose() (Ry −90°, Rx 45°) then bracket-frame arm spin.
//
// Improvements (future):
//   • Auto-compute assembly_kneeler_arm_rotate_x_deg from bumper top vs arm underside.
//   • Share peg x helpers with kneeler-bracket-visual.scad (duplicate near_x/far_x today).
//   • Optional pew/kneeler X placement from transformed steel face, not wedge + plan offset.

render_standalone_export = false;
include <bumper-bracket.scad>
bumper_bracket_debug_face_labels_enabled = false;
cap_suppress_root = true;   // draw the cap in-tree below, not at cap.scad root
include <cap.scad>
include <tread-visual.scad>
include <kneeler-bracket-visual.scad>
include <kneeler-bushing-visual.scad>
include <kneeler-bumper-visual.scad>
include <pew-leg-visual.scad>
include <kneeler-arm-visual.scad>

// ── Preview toggles (assembly only; STL export uses bumper-bracket.scad) ─────
bracket_cross_section = false;
bracket_cross_axis = "x";

show_tread_in_assembly = true;
show_tread_cap_in_assembly = true;
show_tread_cap_hardware_in_assembly = true;
show_kneeler_bracket_in_assembly = true;
show_kneeler_bushing_in_assembly = true;
show_kneeler_bumper_in_assembly = true;
show_pew_leg_in_assembly = true;
show_kneeler_arm_in_assembly = true;

// ── Tread ghost (bracket −Z slot) ────────────────────────────────────────────
function assembly_tread_groove_pocket_center_ly() =
    -tread_groove_pocket_break_tread_face_mm
    + (tread_groove_pocket_inward_y_mm + tread_groove_pocket_break_tread_face_mm) / 2;

function assembly_tread_groove_ceiling_pos() = bracket_pos(
    shell_extent_qr_wedge_mm / 2,
    assembly_tread_groove_pocket_center_ly(),
    assembly_bracket_flange_groove_top_z_mm()
);

function assembly_tread_mate_pos() =
    let (z = assembly_tread_mate_bracket_z_mm())
    [0, assembly_tread_mate_bracket_y_mm(z), z];

module tread_mated_to_bracket() {
    p = assembly_tread_mate_pos();
    translate(p)
        // E-bevel (side D): outer Rx in bracket frame (Y–Z slope), after base Rx 90° + Rz 90° mate.
        rotate([-tread_face_de_extra_angle_deg, 0, 0])
            rotate([90, 0, 0])
                rotate([0, 0, 90])
                    translate([0, 0, -assembly_tread_flange_top_local_z_mm()])
                        double_tread_group();
}

// Shell, screw bores, tread pockets, and tread ghost — one translate/rotate for preview orientation.
module assembly_bumper_bracket_group() {
    translate(assembly_bumper_group_offset_vec())
        rotate(assembly_bumper_group_rotate_deg)
            children();
}

// ── Kneeler stack (kneeler-bracket local: +X length, +Y width, +Z peg up) ───
function assembly_kneeler_bracket_origin_bracket() = [
    assembly_pew_leg_inner_face_x_mm(),
    0,
    0,
];

// Same transform chain as assembly_kneeler_pose(): o + Rx(kneeler tilt) * Ry(−90°) * p.
function assembly_kneeler_local_to_bracket(p) =
    let(
        o = assembly_kneeler_bracket_origin_bracket(),
        cs = cos(assembly_kneeler_bracket_rotate_x_deg),
        sn = sin(assembly_kneeler_bracket_rotate_x_deg),
        after_ry = [-p[2], p[1], p[0]],
        after_rx = [
            after_ry[0],
            after_ry[1] * cs - after_ry[2] * sn,
            after_ry[1] * sn + after_ry[2] * cs,
        ]
    )
    o + after_rx;

function assembly_kneeler_near_peg_center_local() = [
    assembly_kneeler_near_peg_x_mm(),
    0,
    assembly_kneeler_support_top_lz_mm,
];

function assembly_kneeler_far_peg_center_local() = [
    assembly_kneeler_far_peg_x_mm(),
    0,
    assembly_kneeler_support_top_lz_mm,
];

module assembly_kneeler_pose() {
    translate(assembly_kneeler_bracket_origin_bracket())
        rotate([assembly_kneeler_bracket_rotate_x_deg, 0, 0])
            rotate([0, -90, 0])
                children();
}

module kneeler_bracket_at_pew() {
    assembly_kneeler_pose()
        kneeler_bracket_visual_mirrored_for_exploded_view();
}

module kneeler_bushing_at_near_peg() {
    assembly_kneeler_pose()
        translate(assembly_kneeler_near_peg_center_local())
            kneeler_bushing_visual_for_exploded_view();
}

module kneeler_bumper_at_far_peg() {
    assembly_kneeler_pose()
        translate(assembly_kneeler_far_peg_center_local())
            kneeler_bumper_visual_for_exploded_view();
}

// Hole at near peg; arm length ∥ kneeler +X (rotate 180° Y on arm model).
module kneeler_arm_mated_in_kneeler_local() {
    peg_x = assembly_kneeler_near_peg_x_mm();
    z_hole = assembly_kneeler_arm_hole_center_lz_mm();
    assembly_kneeler_pose()
        translate([peg_x + kneeler_arm_length_mm / 2, 0, z_hole])
            rotate([0, 180, 0])
                kneeler_arm_visual_for_exploded_view();
}

// Spin about bracket +X through hole (Y/Z only). Do not rotate inside kneeler_pose.
module kneeler_arm_at_kneeler_pegs() {
    peg_x = assembly_kneeler_near_peg_x_mm();
    pivot_bracket = assembly_kneeler_local_to_bracket([
        peg_x,
        0,
        assembly_kneeler_arm_hole_center_lz_mm(),
    ]);
    translate(pivot_bracket)
        rotate([assembly_kneeler_arm_rotate_x_deg, 0, 0])
            translate(-pivot_bracket)
                kneeler_arm_mated_in_kneeler_local();
}

// ── Pew leg ghost (Ry 90°: plan ∥ bracket Y, thickness ∥ bracket X) ─────────
module pew_leg_at_kneeler() {
    translate([
        assembly_pew_leg_center_x_mm(),
        assembly_pew_leg_center_y_mm(),
        bracket_face_pew_z_mm + pew_leg_thickness_mm / 2 + epsilon,
    ])
        rotate([0, 90, 0])
            pew_leg_visual_for_exploded_view();
}

// ── Root preview ─────────────────────────────────────────────────────────────
module assembly_preview() {
    bracket_export_bed_lift()
        bracket_cross_trim() {
            assembly_bumper_bracket_group() {
                color([1, 0.85, 0.12])
                    shell_body_difference_wedge_bores();
                if (show_tread_in_assembly)
                    color([0.25, 0.25, 0.25, 0.9])
                        translate(exploded_tread_offset_vec())
                            tread_mated_to_bracket();
                if (tread_cap_enabled && show_tread_cap_in_assembly)
                    translate(exploded_cap_offset_pull)
                        color([0.20, 0.55, 0.95, 0.95])
                            tread_cap();
                if (tread_cap_enabled && show_tread_cap_hardware_in_assembly)
                    translate(exploded_cap_offset_pull)
                        tread_cap_hardware_debug();
                bumper_bracket_debug_face_labels();
            }
            if (show_kneeler_bracket_in_assembly)
                color([0.55, 0.55, 0.58, 0.92])
                    kneeler_bracket_at_pew();
            if (show_kneeler_bushing_in_assembly)
                color([0.45, 0.55, 0.85, 0.92])
                    kneeler_bushing_at_near_peg();
            if (show_kneeler_bumper_in_assembly)
                color([0.15, 0.15, 0.15, 0.95])
                    kneeler_bumper_at_far_peg();
            if (show_kneeler_arm_in_assembly)
                color([0.62, 0.48, 0.32, 0.9])
                    kneeler_arm_at_kneeler_pegs();
            if (show_pew_leg_in_assembly)
                color([0.72, 0.58, 0.38, 0.88])
                    pew_leg_at_kneeler();
        }
}

assembly_preview();
