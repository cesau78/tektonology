// --- TEKTONOLOGY KNEELER BOOT SOCKET ---
leg_l = 48.0;
leg_w = 16.3;
wall = 3.5;
total_h = 25.4; // 1 inch
r = 2.0;
$fn = 64; 

// Converted target depths
top_target_depth = 3.175;    // 1/8 inch
bottom_target_depth = 12.7; // 1/2 inch

module kneeler_boot_socket() {
    difference() {
        // THE OUTER SHELL (Rounded via Minkowski)
        minkowski() {
            cube([
                leg_l + (wall*2) - (r*2), 
                leg_w + (wall*2) - (r*2), 
                total_h - (r*2)
            ], center=true);
            sphere(r=r);
        }
        
        // TOP SOCKET (Metal Leg) - Beveled/Rounded Walls
        translate([0, 0, (total_h/2) - (top_target_depth/2) + 0.1])
        minkowski() {
            // Shrink the cube slightly so the sphere "rounds" it back to size
            cube([leg_l - 2, leg_w - 2, top_target_depth], center=true);
            sphere(r=1.0); // Small 1mm internal bevel
        }
            
        // BOTTOM SOCKET (TPU Plug) - Flat Walls
        // Standard cube ensures the TPU sits flush
        translate([0, 0, -(total_h/2) + (bottom_target_depth/2) - 0.1])
            cube([leg_l, leg_w, bottom_target_depth + 0.2], center=true);
    }
}

kneeler_boot_socket();