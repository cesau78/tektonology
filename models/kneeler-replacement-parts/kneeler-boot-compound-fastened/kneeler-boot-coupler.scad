// --- TEKTONOLOGY KNEELER BOOT COUPLER ---  // This is the main socket that the leg insert plugs into. It has two distinct sections:
// 1) The top half, which is designed to fit the metal leg snugly with beveled/rounded walls for easy insertion and durability. 
// 2) The bottom half, which is designed to fit the TPU insert with flat walls for a secure fit. The entire piece is surrounded by a thick outer shell for strength, with rounded edges for comfort and durability. 
include <kneeler-boot-config.scad>

wall = 4.0; // Thickness of the outer shell
top_target_depth = 2;    // 1/8 inch
bottom_target_depth = 6.35; // 1/4 inch
total_h = top_target_depth + bottom_target_depth + wall;
r = 2.0;
$fn = 64; 

// Lip parameters: a ring that sits at the top interior and comes in by lip_inset (mm)
enable_top_lip = true;
lip_inset = 1; // how much narrower than the top socket (mm)
lip_thickness = 2; // vertical thickness of the lip (mm)

module kneeler_boot_coupler() {
    // We'll subtract the internal sockets from the outer shell, then union a lip
    // so the lip remains as built-in material.
    module inner_cuts() {
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

    module top_lip() {
        // Place a rectangular ring (thin plate with a cutout) at the top interior.
        // The outer dimensions match the outer shell opening; the inner cut
        // is inset by lip_inset so the ring "comes in" that much.
        lip_z = ((total_h) - (r*2)) - (lip_thickness ) - 0.1; // slightly below top to ensure proper union

        // outer plate bigger than the outer shell opening to ensure overlap
        outer_x = leg_l + (wall);
        outer_y = leg_w + (wall);

        inner_x = leg_l - 2 - (2 * lip_inset);
        inner_y = leg_w - 2 - (2 * lip_inset);

        translate([0, 0, lip_z])
        difference() {
            // plate that will form the lip body
            minkowski() {
                 cube([outer_x, outer_y, lip_thickness], center=true);
                 sphere(r=1.0); // Small 1mm external bevel on the lip for comfort and durability
            }
  
            // cutout to make it a ring; this is the opening of the top socket reduced by lip_inset
            translate([0, 0, 0])
                cube([inner_x, inner_y, lip_thickness + 2], center=true);
        }
    }

    union() {
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

            // Subtract the inner sockets
            inner_cuts();
        }

        // Optionally union the lip back in so it's present even though the socket was cut out
        if (enable_top_lip) top_lip();
    }
}

kneeler_boot_coupler();