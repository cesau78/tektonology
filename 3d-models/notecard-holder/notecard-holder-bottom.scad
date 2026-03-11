include <notecard-holder-config.scad>
include <perforated-plate.scad>

module bottom() {
    bottom_width = width + 2 * (plate_thick + tolerance);
    rail_height = plate_thick * 2;

    gap_width = (width - plates * plate_thick - plate_thick * 2) / (plates) + plate_thick;
    cut_width = 3 * plate_thick + tolerance * 2;

    union() {
        // Base plate
        perforated_plate(
            p_length    = bottom_width,
            p_width     = length,
            p_thickness = plate_thick,
            p_hole_size = hole_dia,
            p_spacing   = spacing,
            p_length_margin = edge_margin,
            p_width_margin  = edge_margin
        );

        // Rail channels along both long (Y) edges for side plates to slot into.
        // Each channel is two rails with a gap of plate_thick + 2*tolerance between them.
        for (side = [0, 1]) {
            // outer rail
            x_outer = side * (bottom_width - plate_thick);
            translate([x_outer, 0, plate_thick])
                cube([plate_thick, length, rail_height]);

            // inner rail — with gaps cut out for side rails to pass through
            x_inner = side == 0
                ? 2 * plate_thick + tolerance * 2
                : bottom_width - 3 * plate_thick - tolerance * 2;
            difference() {
                translate([x_inner, 0, plate_thick])
                    cube([plate_thick, length, rail_height]);

                for (i = [0 : plates - 1]) {
                    y_cut = i * (plate_thick + gap_width) - tolerance;
                    translate([x_inner - 0.1, y_cut, plate_thick - 0.1])
                        cube([plate_thick + 0.2, cut_width, rail_height + 0.2]);
                }
            }
        }
    }
}

bottom();
