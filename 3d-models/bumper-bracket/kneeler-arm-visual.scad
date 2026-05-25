// Assembly ghost — Atwood-Hamlin kneeler arm (not printed from this folder).
// Local: profile in XY, extruded along Z; pivot hole at +X. Sizes: config.scad kneeler_arm_*.

module kneeler_arm_visual_for_exploded_view() {
    difference() {
        union() {
            linear_extrude(height = kneeler_arm_thickness_mm, center = true)
                polygon(points = [
                    [-kneeler_arm_length_mm / 2, -kneeler_arm_h1_mm / 2],
                    [ kneeler_arm_length_mm / 2, -kneeler_arm_h2_mm / 2],
                    [ kneeler_arm_length_mm / 2,  kneeler_arm_h2_mm / 2],
                    [-kneeler_arm_length_mm / 2,  kneeler_arm_h1_mm / 2],
                ]);
            translate([kneeler_arm_length_mm / 2, 0, 0])
                cylinder(d = kneeler_arm_peg_d_mm, h = kneeler_arm_thickness_mm, center = true);
        }
        translate([kneeler_arm_length_mm / 2, 0, 0])
            cylinder(d = kneeler_arm_peg_hole_d_mm, h = kneeler_arm_thickness_mm + 2, center = true);
    }
}
