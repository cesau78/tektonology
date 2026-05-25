// Assembly ghost — kneeler-bumper.scad. Base at z = 0 mates peg support boss top.

module kneeler_bumper_visual_for_exploded_view() {
    difference() {
        cylinder(h = bumper_h, d = kneeler_bumper_od_mm);
        translate([0, 0, -epsilon])
            cylinder(h = bumper_h + 2 * epsilon, d = kneeler_bumper_id_mm);
    }
}
