// Atwood-Hamlin Kneeler Bracket — reference geometry
// The actual part is a steel bracket manufactured by Atwood-Hamlin Mfg. Co, Inc.
//   atwood-hamlin.com/kneeler-arms · 800-545-8964
// Arm 4: pivot 3½" (88.9 mm) off the floor  ← most common
// Arm 5: pivot 2"  (50.8 mm) off the floor
//
// This model is a visual approximation for the product page.
// Set `mirror_side = false` for left, `mirror_side = true` for right.

$fn = 64;

// ── Parameters ────────────────────────────────────────────────────────────────
mirror_side     = false;    // false = left, true = right

plate_l         = 145;      // overall length  (X)
plate_w         = 34;       // overall width   (Y)
plate_t         = 5;        // plate thickness (Z)
corner_r        = 5;        // fillet radius on plate corners

// Boss — raised collar at the base of each peg
boss_od         = 16;       // boss outer diameter
boss_h          = 3;        // boss height above plate surface

// Peg 1 — pivot stud (near/left end)
peg1_od         = 9.4;
peg1_h          = 24;
peg1_inset      = 18;       // centre from near end

// Peg 2 — rubber bumper stud (far/right end) — matches bumper bore
peg2_od         = 9.4;
peg2_h          = 24;
peg2_inset      = 18;       // centre from far end

// Three countersunk screw holes, evenly spaced across the middle
screw_d         = 5.2;      // shank clearance
csink_d         = 10.5;     // countersink top diameter
csink_depth     = 2.5;      // depth of taper
screw_x_frac    = [0.28, 0.5, 0.72];  // positions as fraction of plate length

// ── Helpers ───────────────────────────────────────────────────────────────────
module rounded_plate(l, w, t, r) {
    hull() {
        for (sx = [-1, 1], sy = [-1, 1])
            translate([sx * (l/2 - r), sy * (w/2 - r), 0])
                cylinder(h=t, r=r);
    }
}

// Tapered countersunk hole: taper sits flush at the top surface
module csunk_hole(shank_d, csink_d, csink_depth, depth) {
    translate([0, 0, -1])
        cylinder(h=depth + 2, d=shank_d);
    translate([0, 0, depth - csink_depth])
        cylinder(h=csink_depth + 1, d1=shank_d, d2=csink_d);
}

// Solid peg on a raised boss collar
module pegged_boss(boss_od, boss_h, peg_od, peg_h) {
    cylinder(h=boss_h, d=boss_od);
    translate([0, 0, boss_h])
        cylinder(h=peg_h, d=peg_od);
}

// ── Main module ───────────────────────────────────────────────────────────────
module kneeler_bracket() {
    near_x = -plate_l/2 + peg1_inset;
    far_x  =  plate_l/2 - peg2_inset;

    difference() {
        rounded_plate(plate_l, plate_w, plate_t, corner_r);

        for (frac = screw_x_frac) {
            sx = frac * plate_l - plate_l/2;
            translate([sx, 0, 0])
                csunk_hole(screw_d, csink_d, csink_depth, plate_t);
        }
    }

    // Peg 1 — pivot stud (near end)
    translate([near_x, 0, plate_t])
        pegged_boss(boss_od, boss_h, peg1_od, peg1_h);

    // Peg 2 — bumper stud (far end)
    translate([far_x, 0, plate_t])
        pegged_boss(boss_od, boss_h, peg2_od, peg2_h);
}

// ── Instantiate ───────────────────────────────────────────────────────────────
if (mirror_side) {
    mirror([0, 1, 0]) kneeler_bracket();
} else {
    kneeler_bracket();
}
