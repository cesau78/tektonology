// Temporary debug wrapper: face-on view of the QR mount-block front face.
// Rotates the bracket so the tilted front-face normal points along +Y,
// then a front-view camera shows the face square-on.
BUMPER_BRACKET_INCLUDED_BY = true;
include <bumper-bracket.scad>

echo("face_angle_deg", pew_mount_block_face_angle_deg);
echo("face_x_lo", pew_mount_block_face_x_lo_mm());
echo("face_x_hi", pew_mount_block_face_x_hi_mm());
echo("face_width_across",
    (pew_mount_block_face_x_hi_mm() - pew_mount_block_face_x_lo_mm()
        + corner_r * sin(pew_mount_block_face_angle_deg))
    / cos(pew_mount_block_face_angle_deg));
echo("face_z_lo", pew_mount_block_face_remaining_z_lo_mm());
echo("face_z_hi", pew_mount_block_face_remaining_z_hi_mm());
echo("face_z_span", pew_mount_block_face_remaining_z_hi_mm() - pew_mount_block_face_remaining_z_lo_mm());
echo("qr_frame_outer", qr_pocket_size_mm + 2 * qr_frame_gap_mm + 2 * qr_frame_line_w_mm);
echo("front_y_at_x_lo", pew_mount_block_front_y_at(pew_mount_block_face_x_lo_mm()));
echo("side_screw_csk_top_y", side_screw_bore_y_mm + side_screw_head_dia_mm / 2 + side_screw_chamfer_lip_mm);

// Center the QR face on the origin, then spin so its outward normal (−sin a,
// cos a, 0) points −Y; a front ortho camera (rot 90,0,0) then views it square-on.
_face_xc = pew_mount_block_face_center_x_mm() + qr_pocket_x_offset_mm;
_face_zc = (pew_mount_block_face_remaining_z_lo_mm() + pew_mount_block_face_remaining_z_hi_mm()) / 2
    - bracket_world_z_min();   // bumper_bracket() applies the bed lift
_face_yc = pew_mount_block_front_y_at(_face_xc);

// qr_face_cross_section = true → 2D projection(cut) 0.05 mm inside the face
// skin (pre-mink plane is y = 0 after the transform; skin at y = −corner_r), so
// the 0.4 mm frame groove and 0.1 mm sticker recess read as holes and the flat
// face reads as solid. Export as SVG for exact coordinate measurement.
qr_face_cross_section = false;

module _qr_face_centered() {
    rotate([0, 0, 180 - pew_mount_block_face_angle_deg])
        translate([-_face_xc, -_face_yc, -_face_zc])
            bumper_bracket();
}

if (qr_face_cross_section)
    projection(cut = true)
        translate([0, 0, corner_r - 0.05])
            rotate([90, 0, 0])   // face normal −Y → −Z; skin plane → z = −corner_r
                _qr_face_centered();
else
    _qr_face_centered();
