// Assembly preview: bumper bracket + prayer-sole v3 tread ghost (mated Z: flange apex ↔ groove slab top).
// Liquid bait v2 has no tread part; open this folder for kneeler+tread pairing.
// Optional pull-apart: exploded_tread_offset_pull in config (+ assembly_tread_vertical_auto_mm / trim in bumper-bracket.scad).

render_standalone_export = false;
include <bumper-bracket.scad>
include <tread-visual.scad>

// Cross-section: half-cut in canonical coords then bracket_rotate_x_deg (shell envelope + wedge). Override axis/offset in config.scad.
bracket_cross_section = false;
bracket_cross_axis = "x";

show_tread_in_assembly = true;

module tread_mated_to_bracket_reference() {
    // XY at inset shell core midplanes; flip pivot shell_midplane_z_mm; slide_z mates tread flange apex ↔ bracket groove slab top (+Z cuboid ceiling).
    cx = assembly_tread_center_qr_wedge_mm;
    cy = assembly_tread_center_tread_pew_mm;
    slide_cz = assembly_tread_slide_z;

    apply_tread_cutout_flip()
        translate([cx, cy, slide_cz])
            rotate([0, 0, 90])
                translate([0, 0, -socket_depth / 2])
                    rotate([180, 0, 0])
                        tread_visual_for_exploded_view();
}

apply_bracket_orientation()
    bracket_cross_trim() {
        color([1, 0.85, 0.12])
            shell_body_difference_wedge_bores();
        if (show_tread_in_assembly)
            color([0.25, 0.25, 0.25, 0.9])
                translate(exploded_tread_offset_vec())
                    tread_mated_to_bracket_reference();
    }
