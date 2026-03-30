// Smoothness of the cylinders
$fn = 64;

// inputs
od = 17.5; // Outer diameter of the bumper
peg_od = 9.7;  // the peg that the bumper fits onto.
tightness = 0.3; // Increase this value for a tighter fit, decrease for a looser fit (mm)
id = peg_od - tightness; // Inner diameter of the bumper, calculated for a snug fit
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
