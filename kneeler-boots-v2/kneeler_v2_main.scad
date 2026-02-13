
// --- TEKTONOLOGY V2: WEDGE-LOCK SYSTEM ---
// Material 1 (Upper): Polymaker PLA Pro (Rigid)
// Material 2 (Pad): TPU 90A (Flexible)

leg_l = 48.0; 
leg_w = 16.3;
lip_h = 12.7; 
wall = 3.5;
sole = 6.0;   
wedge_d = 5.0; 
tolerance = 0.2; 

$fn = 64;

module upper_boot_pla() {
    difference() {
        cube([leg_l + (wall*2), leg_w + (wall*2), lip_h + sole], center=true);
        translate([0,0, (sole/2) + 0.1]) cube([leg_l, leg_w, lip_h], center=true);
        translate([0,0, -(lip_h/2) - (sole/2) + (wedge_d/2)])
            polyhedron(
                points=[
                    [-(leg_l/2+1), -(leg_w/2+1), -wedge_d/2], [ (leg_l/2+1), -(leg_w/2+1), -wedge_d/2], 
                    [ (leg_l/2+1),  (leg_w/2+1), -wedge_d/2], [-(leg_l/2+1),  (leg_w/2+1), -wedge_d/2],
                    [-(leg_l/2+2), -(leg_w/2+2),  wedge_d/2], [ (leg_l/2+2), -(leg_w/2+2),  wedge_d/2], 
                    [ (leg_l/2+2),  (leg_w/2+2),  wedge_d/2], [-(leg_l/2+2),  (leg_w/2+2),  wedge_d/2]
                ],
                faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
            );
    }
}

module floor_pad_tpu() {
    union() {
        translate([0,0, wedge_d/2])
            polyhedron(
                points=[
                    [-(leg_l/2+1-tolerance), -(leg_w/2+1-tolerance), -wedge_d/2], [ (leg_l/2+1-tolerance), -(leg_w/2+1-tolerance), -wedge_d/2], 
                    [ (leg_l/2+1-tolerance),  (leg_w/2+1-tolerance), -wedge_d/2], [-(leg_l/2+1-tolerance),  (leg_w/2+1-tolerance), -wedge_d/2],
                    [-(leg_l/2+2-tolerance), -(leg_w/2+2-tolerance),  wedge_d/2], [ (leg_l/2+2-tolerance), -(leg_w/2+2-tolerance),  wedge_d/2], 
                    [ (leg_l/2+2-tolerance),  (leg_w/2+2-tolerance),  wedge_d/2], [-(leg_l/2+2-tolerance),  (leg_w/2+2-tolerance),  wedge_d/2]
                ],
                faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
            );
        translate([0,0, -2.5]) {
            difference() {
                cube([leg_l + (wall*2), leg_w + (wall*2), 5], center=true);
                for (i = [-(leg_l/2) : 4 : (leg_l/2)]) {
                    translate([i, 0, -2.0]) cube([1.5, leg_w + (wall*2) + 2, 2], center=true);
                }
            }
        }
    }
}

// Uncomment one at a time to export
upper_boot_pla();
// floor_pad_tpu();
