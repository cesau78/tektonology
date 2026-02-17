$fn = 64;
wall = 3;
tardis_dia = 120;
core_dia = 45;
base_height = 40;
bottle_id = 24;
tube_od = 10;
tube_id = 6;
tilt_angle = 30;

port_height = wall + (tube_id / 2);
inner_well_dia = bottle_id + 4;

size = 0; //compact: 0, stndard: 10, large: 20

// Standardized PCO 1881 Thread Profile
thread_pitch = 3; 
thread_depth = 3; // Slightly deeper for better grip
thread_turns = 7;

// Geometry Calculations
arm_length = (tardis_dia / 2) - (core_dia / 2) + size;
upper_z = (port_height) + (arm_length + core_dia/2) * sin(tilt_angle);
tip_r = (arm_length + core_dia/2) * cos(tilt_angle);
lower_z = (tube_od / 2);

union() {
    central_tower();
    for (a = [0 : 60 : 359]) {
        rotate([0, 0, a]) tube_arm();
    }
    upper_tardis();
    lower_tardis();
    connecting_struts();
}

module central_tower() {
    difference() {
        // Outer Tower Body
        cylinder(h=base_height, d=core_dia);
        
        // Reservoir Well
        translate([0, 0, wall]) 
            cylinder(h=base_height, d=inner_well_dia);
        
        // Bottle Neck
        translate([0, 0, 15]) 
            cylinder(h=base_height + 1, d=bottle_id);
        
        // Internal Threads: a series of small cuts that form a spiral thread
        for (i = [0 : 5 : 360 * thread_turns]) {
            rotate([0, 0, i])
            translate([bottle_id/2, 0, 18 + (i/360) * thread_pitch]) {
                rotate([45, 0, 0]) 
                    cube([thread_depth * 2, 1.5, 1.5], center=true);
            }
        }
        
        // Port Holes for the Arms
        for (a = [0 : 60 : 359]) {
            rotate([0, 0, a]) 
                translate([0, 0, port_height]) 
                    rotate([0, 90 - tilt_angle, 0]) 
                        cylinder(h=core_dia, d=tube_id);
        }
    }
}
module tube_arm() {
    // Calculate the length based on your tardis_dia and core_dia 

    // Move to the tower face and tilt up 
    translate([5, 0, 29 + port_height])
    rotate([0, 90 - tilt_angle, 0])
    translate([core_dia / 2, 0, 0])
    
    // Using a single difference here creates the hollow straw effect
    difference() {
        // Main outer cylinder of the arm 
        cylinder(h=arm_length + 3, d=tube_od);
        
        // Internal path (The Straw Hole) 
        // We start the cut slightly before the arm starts (-5) 
        // and end it slightly after (arm_length + 10) to ensure clean openings.
        translate([0, 0, -5]) 
            cylinder(h=arm_length + 10, d=tube_id);
    }
}


module upper_tardis() {
    difference() {
        // 1. The Main Ring
        translate([0, 0, upper_z ])
        rotate_extrude()
        translate([tip_r, 0, 0])
        difference() {
            circle(d=tube_od);
            circle(d=tube_id); 
        }

        // 2. ONE-WAY ARM ENTRANCE HOLES
        for (a = [0 : 60 : 359]) {
            rotate([0, 0, a])
            translate([5, 0, 30 + port_height]) 
            rotate([0, 90 - tilt_angle, 0])
            translate([core_dia / 2, 0, 0])
            // THE FIX: Start at the end of the arm and cut only 
            // deep enough to reach the center of the ring path.
            translate([0, 0, arm_length - 5]) 
                cylinder(h=10, d=tube_id + 0.2);
        }

        // 3. ONE-WAY EXIT HOLES (Downward only)
        for (a = [30 : 60 : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, upper_z]) 
                rotate([180, 0, 0]) 
                    cylinder(h=tube_od/2 + 1, d=tube_id + 0.2);
        }
    }
}


module connecting_struts() {
    for (a = [30 : 60 : 359]) { // Offset by 30 degrees to be halfway between arms
        rotate([0, 0, a])
        translate([tip_r, 0, lower_z])
        difference() {
            // Main vertical strut body
            // Height spans exactly from center of lower ring to center of upper ring
            cylinder(h = upper_z - lower_z, d = tube_od);
            
            // Internal path (The Hole)
            // extend the hole slightly (-1 and +2) to ensure clean 
            // manifold intersections with the ring interiors
            translate([0, 0, -1])
                cylinder(h = (upper_z - lower_z) + 2, d = tube_id);
        }
    }
}
module lower_tardis() {
    difference() {
        // Outer Body
        translate([0, 0, lower_z])
        rotate_extrude() translate([tip_r, 0, 0]) circle(d=tube_od);

        // Hollow Inner Path
        translate([0, 0, lower_z])
        rotate_extrude() translate([tip_r, 0, 0]) circle(d=tube_id);

        // Holes for vertical connectors
         for (a = [30 : 60 : 359]) {
            rotate([0, 0, a]) translate([tip_r, 0, lower_z]) // Start at center of tube
                cylinder(h=tube_od, d=tube_id + 0.2); // Cut upwards only
        }
        
        // entrance holes
        for (a = [0 : 60 : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, lower_z])
            rotate([0, 90, 0]) // Rotate to face outward perpendicular to the ring
                cylinder(h=tube_od, d=tube_id + 0.2, center=true);
        }
    }
}