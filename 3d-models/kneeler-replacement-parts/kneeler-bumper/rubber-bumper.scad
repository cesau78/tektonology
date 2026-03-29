// Smoothness of the cylinders
$fn = 64;

// inputs
od = 17.5; // Outer diameter of the bumper
id = 9.7;  // Inner diameter (hollow core)
height = 23.8; // Total height of the bumper

// Main module to create the rubber bumper
module rubber_bumper() {
    difference() {
        cylinder(h=height, d=od);

        // Remove the inner cylinder to create the hollow core
        translate([0, 0, -1])
            cylinder(h=height + 2, d=id);
    }
}

rubber_bumper();
