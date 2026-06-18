// SPA assembly viewer — left bumper bracket in bracket design frame (no bed lift).
// Export each part with -D export_part=<0|1|2|3>.

bracket_lift_to_bed = false;
preview = false;
$fn = 64;

export_part = 0;  // 0=shell, 1=carriage, 2=tread1, 3=tread2

BUMPER_BRACKET_INCLUDED_BY = true;
include <bumper-bracket.scad>
include <tread-visual.scad>

function assembly_tread_groove_pocket_center_ly() =
    -tread_groove_pocket_break_tread_face_mm
    + (tread_groove_pocket_inward_y_mm + tread_groove_pocket_break_tread_face_mm) / 2;

function assembly_tread_mate_pos() =
    let (z = assembly_tread_mate_bracket_z_mm())
    [tread_pocket_x_nudge_mm, assembly_tread_mate_bracket_y_mm(z), z];

module assembly_tread_mate_base() {
    translate(assembly_tread_mate_pos())
        rotate([-tread_face_de_extra_angle_deg, 0, 0])
            rotate([90, 0, 0])
                rotate([0, 0, 90])
                    translate([0, 0, -assembly_tread_flange_top_local_z_mm()])
                        children();
}

if (export_part == 0)
    bumper_bracket_shell_body();
else if (export_part == 1)
    tread_carriage();
else if (export_part == 2)
    assembly_tread_mate_base()
        tread_visual_for_exploded_view();
else if (export_part == 3)
    assembly_tread_mate_base()
        translate([0, 0, 2 * assembly_tread_flange_top_local_z_mm()])
            mirror([0, 0, 1])
                tread_visual_for_exploded_view();
