// Assembly ghost — kneeler-bushing.scad. z = 0 is collar bottom (mates support boss top).

module kneeler_bushing_visual_for_exploded_view() {
    insert_h = kneeler_bushing_total_height_mm - kneeler_bushing_collar_height_mm;
    difference() {
        union() {
            cylinder(h = kneeler_bushing_collar_height_mm, d = kneeler_bushing_collar_od_mm);
            translate([0, 0, kneeler_bushing_collar_height_mm])
                cylinder(h = insert_h, d = kneeler_bushing_insert_od_mm);
        }
        translate([0, 0, -epsilon])
            cylinder(h = kneeler_bushing_total_height_mm + 2 * epsilon, d = kneeler_bushing_id_mm);
    }
}
