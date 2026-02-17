// --- TEKTONOLOGY KNEELER BOOT FOOT: 7-RIB INSERT ---

leg_l = 33.0;
leg_w = 19.0;
socket_depth = 6.5; //
tightness = 0.1; // Adjust this: 0.0 for snug, 0.2 for very tight
$fn = 64;

ribs = 5; 
radius = socket_depth / 2; // Radius of semi-cylinders

module internal_tpu_insert() {
    insert_l = leg_l + tightness;
    insert_w = leg_w + tightness;
    
    
    // This calculates rib width so the total set fits exactly
    rib_w = (insert_l - ((ribs - 1))) / ribs; 
    pitch = (insert_l - (2 * radius)) / (ribs - 1);

    union() {
        // THE MAIN BODY (The "Core")
        translate([0, 0, socket_depth/2])
            cube([insert_l, insert_w, socket_depth], center=true);
        

        //SEMI-CYLINDERS
        for (i = [0 : ribs - 1]) {
            // Start at the left edge + radius, then move by pitch
            x_pos = (i * pitch) - (insert_l/2) + radius;

            translate([x_pos, 0, 0])
                rotate([90, 0, 0]) 
                    cylinder(h = insert_w, r = radius, center = true); 
        }

        

    }
}

internal_tpu_insert();