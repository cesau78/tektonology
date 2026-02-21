preview = true;
$fn = preview ?  32 : 64;


// Cross-section viewer
// Set to true to cut the model along a plane and show only one side
crosssection_view = false;
// axis: 'x', 'y', or 'z'
crosssection_axis = "z";
// position (mm) along the chosen axis where the cut occurs (default 0 = origin)
crosssection_pos =4.5;



wall = 2;
// Max torus diameter (inches) - set to 4 inches as requested
torus_max_in = 4; // inches
torus_dia = torus_max_in * 25.4; // convert inches to mm (4 in = 101.6 mm)
core_dia = 30;
base_height = 40;
reservoir_id = 24; //standard plastic bottle od
tube_od = 10;
tube_id = 6;
tilt_angle = 30;

port_height = wall + (tube_id / 2);


size = 0; //compact: 0, stndard: 10, large: 20

// Standardized PCO 1881 Thread Profile
thread_pitch = 3; 
thread_depth = 1; // Slightly deeper for better grip
thread_turns = 7;

// Geometry Calculations
// Number of arms and derived angular offsets
arms = 6; // number of radial arms/ports
arm_step = 360 / arms;
strut_offset = arm_step / 2; // halfway between arms
entrance_offset = strut_offset - 10; // entrance offset (e.g., 15 deg for 6 arms)
lower_backstop_offset = entrance_offset + 3; // small tuned offset for backstops
upper_backstop_offset = tube_id; // small tuned offset for backstops

// Desired top of torus aligns with top of reservoir: top = wall + base_height
upper_z = wall + base_height - (tube_od / 2); // center height of torus ring so top aligns

// Compute arm_length so that the slanted arm reaches the torus center at upper_z
arm_length = (abs(sin(tilt_angle)) < 0.0001) ? ((torus_dia / 2) - (core_dia / 2) + size) : (((upper_z - port_height) / sin(tilt_angle)) - core_dia/2);

// radial tip radius (horizontal projection)
tip_r = (arm_length + core_dia/2) * cos(tilt_angle);

lower_z = (tube_od / 2);

// Top-level staged assembly following your requested order:
// 1) build all solids (union)
// 2) define backstops (spheres) but do not subtract them
// 3) apply all inner cutouts (difference)
// 4) union backstops into the result
// 5) subtract/redraw entrance holes last
module liquid_bait_station() {
    // Build each major piece with its local cutouts, then union them, add backstops,
    // and finally subtract the entrance holes so they're redrawn last.
    difference() {
        union() {
         
            // central tower with its cutouts
            difference() {
                central_tower_solid();
                central_tower_cutouts();
            }

            // tube arms (each module handles its own repeating arms)
            difference() {
                tube_arm_solid();
                tube_arm_cutouts();
                central_tower_cutouts();
                upper_torus_cutouts();
            }
            
            // upper torus
            difference() {
                upper_torus_solid();
                upper_torus_cutouts();
                tube_arm_cutouts();
            }
            // union backstops into the body so they exist before entrance holes
            difference() {
                upper_backstops_solid();
                upper_backstops_cutouts();
            }

            // connecting struts
            difference() {
                connecting_struts_solid();
                connecting_struts_cutouts();
                upper_torus_cutouts();
                lower_torus_cutouts();
            }
            // lower torus
            difference() {
                lower_torus_solid();
                lower_torus_cutouts();
                connecting_struts_cutouts();
            }

            // union backstops into the body so they exist before entrance holes
            difference() {
                lower_backstops_solid();
                lower_backstops_cutouts();
            }
            
        }

        // subtract the entrance holes last
        entrance_holes();

    }
    
}


module central_tower() {
    // Deprecated: kept for compatibility; use central_tower_solid() and central_tower_cutouts()
}

module central_tower_solid() {
    render_if_needed() {
        // Outer Tower Body
        cylinder(h=base_height, d=core_dia);
    }
}

module central_tower_cutouts() {
    render_if_needed() {
        // Reservoir Well (cut from outer tower)
        translate([0, 0, wall])
            cylinder(h=base_height, d=reservoir_id);

    // Bottle Neck (cut)
    translate([0, 0, 15])
        cylinder(h=base_height + 1, d=reservoir_id);

        // Internal Threads: a series of small cuts that form a spiral thread
        for (i = [0 : 5 : 360 * thread_turns]) {
            rotate([0, 0, i])
            translate([reservoir_id/2, 0, base_height- 1.5 - ((i/360) * thread_pitch)]) {
                rotate([45, 0, 0]) 
                    cube([thread_depth * 2, 1.5, 1.5], center=true);
            }
        }

        // Port Holes for the Arms
        for (a = [0 : arm_step : 359]) {
                rotate([0, 0, a])
                translate([0, 0, port_height]) 
                    rotate([0, 90 - tilt_angle, 0]) 
                        cylinder(h=core_dia, d=tube_id);
        }
    }
}

module tube_arm_solid() {
    render_if_needed() {
        // Move to the tower face and tilt up (outer cylinder only)
        for (a = [0 : arm_step : 359]) rotate([0,0,a]) {
            translate([5, 0, port_height + 20])
            rotate([0, 90 - tilt_angle, 0])
            translate([core_dia / 2, 0, 0])
                cylinder(h=arm_length - (tube_od / 3) + 3, d=tube_od);
        }
    }
}

module tube_arm_cutouts() {
    render_if_needed() {
        // Internal path (The Straw Hole) - cut
        for (a = [0 : arm_step : 359]) rotate([0,0,a]) {
                translate([5, 0, port_height + 20])
            rotate([0, 90 - tilt_angle, 0])
            translate([core_dia / 2, 0, 0])
                translate([0, 0, -5]) 
                    cylinder(h=arm_length - (tube_od / 3) + 7, d=tube_id);
        }
    }
}

module upper_torus_solid() {
    render_if_needed() {
        // Solid outer ring
        translate([0, 0, upper_z ])
            rotate_extrude()
                translate([tip_r, 0, 0])
                    circle(d=tube_od);
    }
}

module upper_torus_cutouts() {
    render_if_needed() {
        // Hollow inner path
        translate([0, 0, upper_z ])
            rotate_extrude()
                translate([tip_r, 0, 0])
                    circle(d=tube_id);

        // ONE-WAY ARM ENTRANCE HOLES (these are internal arm-to-ring cuts)
        for (a = [0 : arm_step : 359]) {
            rotate([0, 0, a])
            translate([5, 0, 30 + port_height]) 
            rotate([0, 90 - tilt_angle, 0])
            translate([core_dia / 2, 0, 0])
                // cut only deep enough to reach the center of the ring path.
                translate([0, 0, arm_length - 5]) 
                    cylinder(h=10, d=tube_id + 0.2);
        }

        // ONE-WAY EXIT HOLES (Downward only)
        for (a = [strut_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, upper_z]) 
                rotate([180, 0, 0]) 
                    cylinder(h=tube_od/2 + 1, d=tube_id + 0.2);
        }
    }
}

module connecting_struts_solid() {
    render_if_needed() {
        for (a = [strut_offset : arm_step : 359]) { // Offset by half-step to be halfway between arms
            rotate([0, 0, a])
            translate([tip_r, 0, lower_z])
                // Main vertical strut body
                cylinder(h = upper_z - lower_z, d = tube_od);
        }
    }
}

module connecting_struts_cutouts() {
    render_if_needed() {
        for (a = [strut_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, lower_z])
                // Internal path (The Hole) - cut
                translate([0, 0, -1])
                    cylinder(h = (upper_z - lower_z) + 2, d = tube_id);
        }
    }
}

module lower_torus_solid() {
    render_if_needed() {
        // Solid outer torus
        translate([0, 0, lower_z])
            rotate_extrude() translate([tip_r, 0, 0]) circle(d=tube_od);
    }
}

module lower_torus_cutouts() {
    render_if_needed() {
        // Hollow Inner Path (cut)
        translate([0, 0, lower_z])
            rotate_extrude() translate([tip_r, 0, 0]) circle(d=tube_id);

        // Holes for vertical connectors (cut)
        for (a = [strut_offset : arm_step : 359]) {
            rotate([0, 0, a]) translate([tip_r, 0, lower_z]) // Start at center of tube
                cylinder(h=tube_od, d=tube_id + 0.2); // Cut upwards only
        }
    }
}

module upper_backstops_solid() {
    render_if_needed() {
        // Spheres placed inside the lower torus as backstops
        for (a = [upper_backstop_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, upper_z])
                sphere(d=tube_id + 2);
        }
    }
}
module upper_backstops_cutouts() {
    render_if_needed() {
        // Spheres placed inside the lower torus as backstops
        for (a = [2 : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, upper_z])
                sphere(d=tube_id);
        }
    }
}
module lower_backstops_solid() {
    render_if_needed() {
        // Spheres placed inside the lower torus as backstops
        for (a = [lower_backstop_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, lower_z])
                sphere(d=tube_id + 2);
        }
    }
}
module lower_backstops_cutouts() {
    render_if_needed() {
        // Spheres placed inside the lower torus as backstops
        for (a = [entrance_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, lower_z])
                sphere(d=tube_id);
        }
    }
}

module entrance_holes() {
    // Entrance holes are subtracted last to 'redraw' the openings
    // place the hole centers on the inner face of the torus so they only open to the inside
    entrance_r = tip_r - (tube_od / 2) - 0.5; // slightly inset to sit on inner surface
    hole_depth = (tube_od / 2) ; // how far the cutting cylinder penetrates inward
    for (a = [entrance_offset : arm_step : 359]) {
        rotate([0, 0, a])
        translate([entrance_r, 0, lower_z])
        rotate([0, 90, 0]) // Rotate so cylinder points radially
            cylinder(h=hole_depth, d=tube_id + 0.2); // default center=false so cylinder starts at translate
    }
}
// Optionally render a cross-section (half) view so you can inspect internals
if (!crosssection_view) {
    liquid_bait_station();
} else {
    // Intersect the model with a very large half-space cube to show only one side
    intersection() {
        liquid_bait_station();
        half_space = 2000; // large extent to fully cover the model
        // keep the positive side of the chosen axis starting at crosssection_pos
        if (crosssection_axis == "x")
            translate([crosssection_pos, -half_space, -half_space])
                cube([half_space*2, half_space*2, half_space*2]);
        if (crosssection_axis == "y")
            translate([-half_space, crosssection_pos, -half_space])
                cube([half_space*2, half_space*2, half_space*2]);
        if (crosssection_axis == "z")
            translate([-half_space, -half_space, crosssection_pos])
                cube([half_space*2, half_space*2, half_space*2]);
    }
}

// Helper: conditionally wrap children() with render() when not in preview mode.
// Use this to avoid duplicate code while ensuring expensive geometry is pre-tessellated.
module render_if_needed() {
    if (!preview)
        render() children();
    else
        children();
}
