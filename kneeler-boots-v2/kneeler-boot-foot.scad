// --- TEKTONOLOGY KNEELER BOOT FOOT: 7-RIB INSERT ---

leg_l = 48.0;
leg_w = 19.0;
half_h = 12.7; // 1/2 inch
tightness = 0.2; // Adjust this: 0.0 for snug, 0.2 for very tight
$fn = 64;

ribs = 7; 
gap_w = 1.0; 


module internal_tpu_insert() {
    insert_l = leg_l + tightness;
    insert_w = leg_w + tightness;
    
    
    // This calculates rib width so the total set fits exactly
    rib_w = (insert_l - ((ribs - 1) * gap_w)) / ribs; 
    
    // The "Pitch" is the distance from the start of one rib to the start of the next
    pitch = rib_w + gap_w; 

    difference() {
        // 1. THE MAIN BODY (The "Core")
        translate([0, 0, half_h/2])
            cube([insert_l, insert_w, half_h], center=true);
            
        // CENTERING LOGIC
        // start at the far left edge and move right
        // The "- (insert_l/2) + (rib_w/2)" centers the first rib
        for (i = [0 : ribs - 1]) {
            x_pos = (i * pitch) - (insert_l/2) + (rib_w/2);
            
            // GAPS between the ribs: half a pitch to cut the space
            if (i < ribs - 1) {
                gap_x_pos = x_pos + (pitch/2);
                translate([gap_x_pos, 0, 0]) 
                    cube([gap_w, insert_w + 2, 8], center=true);
            }
        }
    }
}

internal_tpu_insert();