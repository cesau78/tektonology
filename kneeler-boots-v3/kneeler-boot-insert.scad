include <kneeler-boot-config.scad>

// --- TEKTONOLOGY KNEELER BOOT FOOT: 7-RIB INSERT --- // This is the internal TPU insert that slips into the bottom half of the coupler. It has a main rectangular body with 7 evenly spaced semi-cylindrical ribs on the bottom to create a secure, high-friction fit within the socket. The dimensions are designed to be slightly larger than the socket for a tight fit, and the ribs provide additional grip and stability when kneeling. 
socket_depth = 6.5; //depth of the socket to slip into
core_protrusion = 2; //core extension beyond the socket

tightness = 0.1; // Adjust this: 0.0 for snug, 0.2 for very tight
$fn = 64;

ribs = 7; 
radius = socket_depth / 2; // Radius of semi-cylinders

module internal_tpu_insert() {
    core_depth = socket_depth + core_protrusion; //thickness of main body
    insert_l = leg_l + tightness;
    insert_w = leg_w + tightness;
    
    
    // This calculates rib width so the total set fits exactly
    rib_w = (insert_l - ((ribs - 1))) / ribs; 
    pitch = (insert_l - (2 * radius)) / (ribs - 1);

    union() {
        // THE MAIN BODY (The "Core")
        translate([0, 0, socket_depth/2])
            cube([insert_l, insert_w, core_depth], center=true);
        

        //SEMI-CYLINDERS
        for (i = [0 : ribs - 1]) {
            // Start at the left edge + radius, then move by pitch
            x_pos = (i * pitch) - (insert_l/2) + radius;
            
            //center cylinder at edge of core
            z_axis = -1 * (core_protrusion / 2);

            translate([x_pos, 0, z_axis])
                rotate([90, 0, 0]) 
                    cylinder(h = insert_w, r = radius, center = true); 
        }

        

    }
}

internal_tpu_insert();