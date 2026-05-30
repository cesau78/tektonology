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
                sphere(r = tread_visual_flange_sphere_r, $fn = preview ? 12 : 24);
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

// Two treads stacked flange-to-flange (back-to-back): the second is the first
// mirrored across the flange-top plane, so their flange faces meet and the cores
// point in opposite local-Z directions (combined flange envelope = 2× single).
// The group keeps the single-tread anchor (flange top at z = flange-top plane), so
// mating the group leaves tread 1 exactly where the single tread sat; tread 2 only
// extends past the shared flange face.
module double_tread_group() {
    flange_top = assembly_tread_flange_top_local_z_mm();
    // Tread 1 — unchanged from the single-tread placement.
    tread_visual_for_exploded_view();
    // Tread 2 — reflected about z = flange_top (flange faces meet, core points opposite).
    translate([0, 0, 2 * flange_top])
        mirror([0, 0, 1])
            tread_visual_for_exploded_view();
}
