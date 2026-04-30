// Smoothness of the cylinders
$fn = 64; 

//inputs
od=16.2; // Outer diameter of the collar
id=10; // Inner diameter of the spacer
h=3.25; // Height of the collar that will sit above the insert


// Main module to create the spacer
module kneeler_spacer() {
    difference() {
        
        cylinder(h=h, d=od); // disk shape of the collar
        

        //remove the inner material to create the hollow spacer
        translate([0, 0, -1]) // Subtract a slightly taller inner cylinder to create the hollow bushing
            cylinder(h=h + 2, d=id); // Inner (slightly taller to ensure clean cut)
    }
}

kneeler_spacer();