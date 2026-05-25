// Assembly ghost — prayer-sole v3-compound-fastened/tread.scad tread_positive().
// Update if the printed tread geometry changes.

module tread_visual_for_exploded_view() {
    ribs = 10;
    pitch = (tread_l - (2 * radius)) / (ribs - 1);

    union() {
        translate([0, 0, socket_depth / 2])
            cube([tread_l, tread_w, core_depth], center = true);

        translate([0, 0, socket_depth / 2 + core_depth / 2 - flange_depth / 2 - 1])
            minkowski() {
                cube([groove_l - 2, groove_w - 2, flange_depth], center = true);
                sphere(r = 1.0, $fn = preview ? 12 : 24);
            }

        for (i = [0 : ribs - 1]) {
            x_pos = (i * pitch) - (tread_l / 2) + radius;
            z_axis = -1 * (core_protrusion / 2);
            translate([x_pos, 0, z_axis])
                rotate([90, 0, 0])
                    cylinder(h = tread_w, r = radius, center = true);
        }
    }
}
