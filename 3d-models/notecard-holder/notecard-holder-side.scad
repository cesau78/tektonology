include <notecard-holder-config.scad>
include <notecard-holder-divider.scad>
module side() {
    union() {
        divider();

        // Rails are evenly distributed across the width,
        // creating channels that straddle each divider plate.
        // Edge rails are flush with the plate edges.
        gap_width = (width - plates * plate_thick - plate_thick * 2) / (plates) + plate_thick;
        rail_height = 3;  // protrusion height to grip dividers

        // Rails — one per divider slot, flush at each edge
        for (i = [0 : plates - 1]) {
            x_pos_left = i * (plate_thick + gap_width) - tolerance;
            translate([x_pos_left, 0, 0])
                cube([plate_thick, height, plate_thick * 2]);

            x_pos_right = i * (plate_thick + gap_width) + plate_thick + plate_thick + tolerance;
            translate([x_pos_right, 0, 0])
                cube([plate_thick, height, plate_thick * 2]);
        }
    }
}

side();
