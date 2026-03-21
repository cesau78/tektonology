// PTFE Dryer Box Port — Single-tube angled passthrough
// S-shaped: filament port angles 45° upward on outside of wall,
// wall plug goes straight through the dryer box wall.
// Flange sits flush and vertical against the wall surface.
include <ptfe-port-dryer-box-config.scad>

// Coordinate system:
//   Origin  = center of flange, on the wall surface
//   +Y      = into the wall (into the dryer box)
//   +Z      = up
//   -Y      = outward (away from wall)


// Cross-section settings
crosssection_view = false;
crosssection_axis = "y";  // "x", "y", or "z"

if (!crosssection_view) {
    ptfe_port_dryer_box();
} else {
    half = 50;
    intersection() {
        ptfe_port_dryer_box();
        if (crosssection_axis == "x")
            translate([0, -half, -half])
                cube([half, half * 2, half * 2]);
        if (crosssection_axis == "y")
            translate([-half, 0, -half])
                cube([half * 2, half, half * 2]);
        if (crosssection_axis == "z")
            translate([-half, -half, 0])
                cube([half * 2, half * 2, half]);
    }
}




module ptfe_port_dryer_box() {
    difference() {
        union() {
            // Flange — vertical disc on outside of wall, centered on wall plug
            translate([0, 0, plug_z_offset])
                    rotate([90, 0, 0])
                        cylinder(h = flange_thick, d = flange_dia);

            // Wall plug — straight through the wall, perpendicular
            translate([0, 0, plug_z_offset])
                    rotate([-90, 0, 0])
                        cylinder(h = dryer_box_thickness, d = plug_dia);

            // Filament port — angles upward and outward from flange
            // Hull fills the gap between the tilted port base and the flat flange
            union() {
                rotate([channel_angle, 0, 0])
                    cylinder(h = socket_depth, d = port_dia);
                hull() {
                    rotate([channel_angle, 0, 0])
                        cylinder(h = 0.01, d = port_dia);
                    rotate([90, 0, 0])
                        translate([0, 0, flange_thick])
                            cylinder(h = 0.01, d = port_dia);
                }
            }
        }

        // Single straight PTFE channel — from chamfer to wall plug exit
        hull() {
            rotate([channel_angle, 0, 0])
                translate([0, 0, socket_depth - flare_depth])
                    cylinder(h = 0.01, d = hole_dia);
            translate([0, 0, plug_z_offset - 0.5])
                rotate([-90, 0, 0])
                    translate([0, 0, dryer_box_thickness])
                        cylinder(h = 0.01, d = hole_dia);
        }

        // Chamfered opening at tip of filament port
        rotate([channel_angle, 0, 0])
            translate([0, 0, socket_depth - flare_depth])
                cylinder(h = flare_depth + 1, d1 = hole_dia, d2 = flare_dia);

        // Cut all material from y=-5 to y=-12
        translate([-flange_dia, -12, -flange_dia])
            cube([flange_dia * 2, 7, flange_dia * 2]);

        // Hollow tube along Y axis — removes material outside flange diameter
        translate([0, 0, plug_z_offset])
            rotate([-90, 0, 0])
                translate([0, 0, -socket_depth - flange_thick - 1])
                    difference() {
                        cylinder(h = socket_depth + flange_thick + dryer_box_thickness + 2, d = flange_dia * 3);
                        cylinder(h = socket_depth + flange_thick + dryer_box_thickness + 2, d = flange_dia);
                    }

        // Grip notches — cut into top and bottom of wall plug, 0.5 from exit end
        translate([-1, dryer_box_thickness - 1.0, plug_z_offset + plug_dia / 2 - 0.5])
            cube([2, 0.5, 0.5]);
        translate([-1, dryer_box_thickness - 1.0, plug_z_offset - plug_dia / 2])
            cube([2, 0.5, 0.5]);

        // Trim filament port flush with flange on wall side
        // Ring: ID = wall plug, OD = flange
        translate([0, 0, plug_z_offset])
            rotate([-90, 0, 0])
                translate([0, 0, -1])
                    difference() {
                        cylinder(h = dryer_box_thickness + 2, d = flange_dia * 2);
                        cylinder(h = dryer_box_thickness + 2, d = plug_dia);
                    }
    }
}

