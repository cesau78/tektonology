// Smoothness of the cylinders
$fn = 64; 

//inputs
total_height = 24; // Total height of the bushing, including the collar and the insert
id=9.5; // Inner diameter of the bushing
insert_od=13.1; // Outer diameter of the bushing that will fit into the pew
collar_height=6.3; // Height of the collar that will sit above the insert
collar_od=16.2; // Outer diameter of the collar

// calculations
insert_height = total_height - collar_height;// Height of the bushing that will fit into the pew

// Main module to create the bushing
module kneeler_bushing() {
    difference() {
        //combine 2 cylinders to create the main shape of the bushing with a collar on top
        union()  {
            cylinder(h=collar_height, d=collar_od); // Collar
            translate([0, 0, collar_height]) {
                cylinder(h=insert_height, d=insert_od); // Pew Insert
            }
        }

        //remove the inner material to create the hollow bushing
        translate([0, 0, -1]) // Subtract a slightly taller inner cylinder to create the hollow bushing
            cylinder(h=total_height + 2, d=id); // Inner (slightly taller to ensure clean cut)
    }
}
