// Smoothness of the cylinders
$fn = 64; 

difference() {
    // First Cylinder: OD=16, ID=11, H=5
    union()  {
        cylinder(h=5, d=16); // Outer
        translate([0, 0, 5]) {
            cylinder(h=19, d=13); // Inner (slightly taller to ensure clean cut)
        }
    }

     translate([0, 0, -1]) 
        cylinder(h=27, d=9); // Inner (slightly taller to ensure clean cut)
}
