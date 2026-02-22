// Smoothness of the cylinders
$fn = 64; 

id=9.5; // Inner diameter of the bushing
insert_od=13.1; // Outer diameter of the bushing that will fit into the pew
insert_height=19; // Height of the bushing that will fit into the pew
collar_height=6.3; // Height of the collar that will sit above the insert
collar_od=16.2; // Outer diameter of the collar

total_height = insert_height + collar_height;

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
