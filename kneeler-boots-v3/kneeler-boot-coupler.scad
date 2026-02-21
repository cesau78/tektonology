include <kneeler-boot-config.scad>

// --- TEKTONOLOGY KNEELER BOOT COUPLER ---  // This is the main socket that the leg insert plugs into. It has two distinct sections:
// 1) The top half, which is designed to fit the metal leg snugly with beveled/rounded walls for easy insertion and durability. 
// 2) The bottom half, which is designed to fit the TPU insert with flat walls for a secure fit. The entire piece is surrounded by a thick outer shell for strength, with rounded edges for comfort and durability. 


wall = 4.0; // Thickness of the outer shell
top_target_depth = 3.175;    // 1/8 inch
bottom_target_depth = 6.35; // 1/4 inch
total_h = top_target_depth + bottom_target_depth + wall;
r = 2.0;
$fn = 64; 

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