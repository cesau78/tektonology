include <notecard-holder-config.scad>

module divider() {
    union() {
        difference() {
            cube([width, height, plate_thick]);
            for (r = [0 : height / hole_dia - 2])
                for (c = [0 : width / hole_dia - 10])
                    translate([
                        hole_x0 + c * spacing + (r % 2) * stagger - 4,
                        edge_margin + r * row_spacing ,
                        -0.1
                    ])
                        cylinder(h = plate_thick + 0.2, d = hole_dia, $fn = $fn);
        }
    }
}

divider();
