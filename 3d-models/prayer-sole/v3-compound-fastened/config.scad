// --- TEKTONOLOGY PRAYER SOLE V3 CONFIG ---
// Shared parameters and modules for the 2-piece coupler (collar + cap)

tolerance = 0.1; // general tolerance for fit adjustments (mm)

// --- Sole Plate Dimensions ---
sole_plate_l = 53;
sole_plate_w = 18.5;
sole_plate_h = 3.5;

// --- Leg Dimensions (for socket fit) ---
leg_w = 16.5;
leg_l = 51;

// --- Bottom Slide Groove (shared between coupler + tread) ---
groove_overhang = 2;      // groove extends this far beyond socket per side

// --- Performance Settings ---
// Default matches stamp-config `preview`; export scripts pass -D preview= for CI (see scripts/export-open-scad-stl.sh).
preview = false; // true = fast mesh ($fn=32); false = production ($fn=128)
crosssection_view = false; // Set to true to cut the model along a plane and show only one side
crosssection_axis = "y"; // axis: 'x', 'y', or 'z'
crosssection_pos = 12; // position (mm) along the chosen axis where the cut occurs (default 0 = origin)

// --- Shell Geometry ---
wall = 9.0; // thicker walls to house M3 hardware in the side walls
floor_thickness = 3.0; // thickness of the shell floor under the bottom socket

bottom_target_depth = 6.35;
total_h = sole_plate_h + bottom_target_depth + floor_thickness;
r = 2.0;
$fn = preview ? 32 : 128;

// --- Lip Parameters ---
enable_top_lip = true;
lip_inset = 1;
lip_thickness = 3;
lip_height = 1;  // Z thickness of cap lip relief cut in collar

// --- Two-Piece Split ---
cap_thickness = 8; // along X axis
split_x = (sole_plate_l / 2) + wall - r - cap_thickness;

// --- Derived ---
outer_extent = (sole_plate_l / 2) + wall; // half-length of outer shell after minkowski
cap_width = sole_plate_w + (groove_overhang * 2) + 4; // cap Y width matches bottom groove (including minkowski)
// Lip ring inner opening dimensions (used for lip splitting)
lip_inner_x = leg_l + tolerance;
lip_inner_y = leg_w + tolerance; // add some clearance around the leg for easy fit and print tolerance

// --- M3x30 Socket Head Cap Screw Hardware ---
bolt_dia        = 3.0;
bolt_clearance  = 0.22;  // clearance for bolt holes (0 for snug fit, increase if needed for print tolerance)
bolt_length     = 20;   // M3x20 — shaft length under head (very common size)
nut_af          = 5.5;  // hex nut across-flats
nut_clearance   = 0.2;  // nut fit clearance — across flats AND thickness (matches bumper-bracket cap_nut_clearance)
nut_thickness   = 2.4;  // typical M3 nut thickness, adjust if using thinner/heavier nuts
nut_pocket_x_extra = 0.5; // hex pocket extends this far ±X beyond nut_thickness envelope; slot unchanged
head_dia        = 6.0;  // M3 socket head cap screw head diameter
head_clearance  = tolerance;
head_height     = 2.5;   // M3 socket head height
head_pocket_chamfer_len     = 2.0; // chamfer depth toward collar (−X) from chamfer start
head_pocket_chamfer_x_offset = 0.1; // shift chamfer start +X from pocket inner face (mm)

// Nut X position: derived so bolt tip fully engages the nut with 0.5mm margin
// bolt shaft starts at outer_extent - head_height, tip = start - bolt_length
nut_x_derived    = (outer_extent - head_height) - bolt_length + (nut_thickness / 2) + 0.5;
nut_x_cap_offset = 2;  // shift pockets/slots toward cap (+X); bolt channel stays at nut_x_derived
nut_x            = nut_x_derived + nut_x_cap_offset;
// Collar bolt shaft bore — fixed span along X (does not follow nut_x_cap_offset)
bolt_channel_start  = nut_x_derived - nut_thickness / 2 - 1;
bolt_channel_length = split_x - bolt_channel_start + 1;

// Bolt position: two screws aligned with cap side bosses (Y = ±cap_width/2)
bolt_z = (bolt_dia / 2) + 0.5; // bottom of bolt hole 0.5mm above z=0
bolt_positions = [[bolt_z, cap_width / 2], [bolt_z, -cap_width / 2]];

// --- Cap Side Bosses ---
boss_dia       = head_dia;    // matches cap screw head diameter
boss_height    = head_height; // adjust with screw availability
boss_clearance = tolerance; // clearance per side between cap boss and collar socket

// --- Cap print supports (snap-off where noted) ---
boss_print_support_enable = true;
// Support pillars for boss edges — designed for X-down printing.  Straight
// tapered pillars on the outer boss circumference, from the bed face (+X)
// to the pocket ceiling; connected at their bases for bed adhesion.
boss_support_boss_flank_enable = true;
tree_base_width      = 1.25;      // YZ extent of each pillar at bed face (mm)
tree_branch_tip      = 0.42;     // tip cube size at boss contact — snap-off point (mm)
tree_branch_angles   = [-45, -30, -15, 0, 15, 30, 45]; // outer half-circle, X-down print
// Fractions of (boss_rim_radius) for extra pillars on the curved face (inboard of rim). Stay > bolt hole.
tree_support_radius_fracs = [1.0, 0.82, 0.66];
tree_inner_tip_scale      = 0.88; // slightly smaller tips on inboard rings (snap-off)
tree_brim_width      = 3.2;       // inward (+/−Y toward cap center) brim reach (mm)
// X-down: bed is +X. Keep +X lip small; extend brim −X into the part for adhesion.
tree_brim_outward_lip = 0.15;     // max +X past outer_extent (do not increase for “wider skirt”)
tree_brim_inward      = 1.15;     // −X depth of brim into the model from outer_extent (mm)
tree_bridge_x         = 0.55;     // X thickness of bed-face links between pillar bases (mm)

// --- Alignment Tongue ---
tongue_width     = 10;   // along Y
tongue_height    = 6;    // along Z
tongue_depth     = 1.5;  // protrusion along X
tongue_clearance = tolerance;

// --- Cap/collar guide pins (alignment at split face) ---
inch = 25.4;
guide_pin_enable      = true;
guide_pin_radius      = 2;                // Ø 4.0 mm
guide_pin_dia         = 2 * guide_pin_radius;
guide_pin_len         = 2.0;              // mm rod protrusion from cap split (−X)
guide_pin_hole_depth  = 4.1;              // mm collar bore depth from split face
guide_pin_cap_overlap = 0.5;              // rod starts this far +X of split for shell fusion
guide_pin_dome_radius = 2;                // domed tip sphere at collar-facing end
guide_pin_hole_clearance = 0.05;           // extra hole radius for easy peg fit
guide_pin_hole_cap_extra = 0.1;             // bore extends +X past split for preview gap
// Z: midway between bolt-hole bottom and shell exterior bottom
bolt_hole_bottom_z = bolt_z - (bolt_dia / 2);
shell_bottom_z     = -(total_h / 2);
guide_pin_z        = (bolt_hole_bottom_z + shell_bottom_z) / 2;
// Y: midway between tread groove outer edge (cap width) and coupler outer Y
tread_slot_edge_y  = cap_width / 2;
slipper_outer_y    = (sole_plate_w + (wall * 2) - (r * 2)) / 2 + r;
guide_pin_y_inset  = 1;   // mm inward from midpoint toward center (+Y side)
guide_pin_y        = (tread_slot_edge_y + slipper_outer_y) / 2 - guide_pin_y_inset;
guide_pin_positions = [[guide_pin_z, guide_pin_y], [guide_pin_z, -guide_pin_y]];

module guide_pin_rods() {
    if (guide_pin_enable) {
        for (pos = guide_pin_positions) {
            translate([split_x + guide_pin_cap_overlap, pos[1], pos[0]])
                rotate([0, -90, 0])
                    cylinder(h=guide_pin_len + guide_pin_cap_overlap, r=guide_pin_radius);
            translate([split_x - guide_pin_len, pos[1], pos[0]])
                sphere(r=guide_pin_dome_radius);
        }
    }
}

module guide_pin_holes() {
    if (guide_pin_enable) {
        for (pos = guide_pin_positions)
            translate([split_x + guide_pin_hole_cap_extra, pos[1], pos[0]])
                rotate([0, -90, 0])
                    cylinder(h=guide_pin_hole_depth + guide_pin_hole_cap_extra, r=guide_pin_radius + guide_pin_hole_clearance);
    }
}

// --- Big constant for half-space clipping ---
big = 200;

// =====================================================================
// COUPLER SHELL — outer shell + sockets, WITHOUT the top lip
// =====================================================================
module coupler_shell() {
    module inner_cuts() {
        // TOP SOCKET (Metal Leg) — beveled/rounded walls
        translate([0, 0, (total_h / 2) - (sole_plate_h / 2) + tolerance])
            minkowski() {
                cube([leg_l, leg_w, sole_plate_h], center=true);
                sphere(r=1.0);
            }

        // BOTTOM SOCKET (TPU Plug) — flat walls
        translate([0, 0, -(total_h / 2) + (bottom_target_depth / 2) - tolerance])
            cube([sole_plate_l, sole_plate_w, bottom_target_depth + 0.2], center=true);

        // BOTTOM SOCKET SLIDE GROOVE — rounded perimeter, wider than socket for slide-in rail
        // 1/4 socket depth, top aligned to top of bottom socket
        groove_h = bottom_target_depth / 4;
        translate([0, 0, -(total_h / 2) + bottom_target_depth - (groove_h / 2) - 1])
            minkowski() {
                cube([
                    sole_plate_l + (groove_overhang * 2) - 2,
                    sole_plate_w + (groove_overhang * 2) - 2,
                    groove_h
                ], center=true);
                sphere(r=1.0);
            }
    }

    difference() {
        minkowski() {
            cube([
                sole_plate_l + (wall * 2) - (r * 2),
                sole_plate_w + (wall * 2) - (r * 2),
                total_h - (r * 2)
            ], center=true);
            sphere(r=r);
        }
        inner_cuts();
    }
}

// =====================================================================
// TOP SOCKET CUT — reusable for re-cutting after lip is added
// =====================================================================
module top_socket_cut() {
    // Flat cut — shaves 2*tolerance off the underside of the lip
    cut_h = tolerance * 2;
    lip_r = 1.0;
    lip_bottom_z = (total_h / 2) - lip_r + (lip_thickness / 2) - (lip_thickness / 2);
    translate([0, 0, lip_bottom_z + (cut_h / 2)])
        cube([sole_plate_l, sole_plate_w, cut_h], center=true);
}

// =====================================================================
// TOP LIP — standalone module (full rectangular ring)
// =====================================================================
module top_lip() {
    lip_r = 1.0; // Minkowski rounding radius for lip
    // Positioned so flat bottom overlaps shell top by lip_r for bonded fit
    lip_z = (total_h / 2) - lip_r + (lip_thickness / 2);
    cut_z = lip_z - (lip_thickness / 2); // flat bottom plane
    outer_x = sole_plate_l + wall;
    outer_y = sole_plate_w + wall;

    intersection() {
        translate([0, 0, lip_z])
        difference() {
            minkowski() {
                cube([outer_x, outer_y, lip_thickness], center=true);
                sphere(r=lip_r);
            }
            // Ring cutout
            cube([lip_inner_x, lip_inner_y, lip_thickness + 2], center=true);
            // Underside relief
            translate([0, 0, -(lip_thickness / 2) - 1])
                minkowski() {
                    cube([leg_l, leg_w, 0.01], center=true);
                    sphere(r=lip_r);
                }
        }
        // Remove bottom Minkowski rounding for flat bonded fit to collar
        translate([-big, -big, cut_z])
            cube([big * 2, big * 2, big * 2]);
    }
}

// =====================================================================
// SPLIT LIP MODULES
// =====================================================================

// Collar lip: -X short end and long-side overhangs on the entrance (-X) end only.
module collar_lip() {
    lip_x_max = lip_inner_x / 2;
    intersection() {
        top_lip();
        union() {
            translate([-big, -big, -big])
                cube([big + lip_x_max, big * 2, big * 2]);
            translate([-big, lip_inner_y / 2, -big])
                cube([big + lip_x_max, big, big * 2]);
            translate([-big, -big - lip_inner_y / 2, -big])
                cube([big + lip_x_max, big, big * 2]);
        }
    }
}

// Cap lip: +X short-end bar plus long-side overhangs on the cap (+X) end.
module cap_lip() {
    intersection() {
        top_lip();
        union() {
            translate([lip_inner_x / 2, -lip_inner_y / 2, -big])
                cube([big, lip_inner_y, big * 2]);
            translate([lip_inner_x / 2, lip_inner_y / 2, -big])
                cube([big, big, big * 2]);
            translate([lip_inner_x / 2, -big - lip_inner_y / 2, -big])
                cube([big, big, big * 2]);
        }
    }
}

// =====================================================================
// HALF-SPACE helpers
// =====================================================================

module collar_half_space() {
    translate([-big, -big, -big])
        cube([big + split_x, big * 2, big * 2]);
}

module cap_half_space() {
    translate([split_x, -big, -big])
        cube([big, big * 2, big * 2]);
}

// Side-wall Y bands (material outside the cap width)
module side_bands() {
    // +Y band
    translate([-big, cap_width / 2, -big])
        cube([big * 2, big, big * 2]);
    // -Y band
    translate([-big, -big - cap_width / 2, -big])
        cube([big * 2, big, big * 2]);
}

// Side-wall strips in the cap zone (+X of split): from each cap Y edge to the shell
// outer edge.  The flat side_bands clip at Y = ±cap_width/2 only kisses the boss
// cylinder at its equator; extend inward by boss_dia/2 so the band wraps the boss
// arc and fuses above/below in Z.
module cap_zone_side_walls() {
    band_inset = boss_dia / 2;
    intersection() {
        coupler_shell();
        cap_half_space();
        union() {
            translate([-big, cap_width / 2 - band_inset, -big])
                cube([big * 2, big, big * 2]);
            translate([-big, -big - cap_width / 2 + band_inset, -big])
                cube([big * 2, big, big * 2]);
        }
    }
}

// Center Y band (material inside the socket footprint)
module center_band() {
    translate([-big, -sole_plate_w / 2, -big])
        cube([big * 2, sole_plate_w, big * 2]);
}

// =====================================================================
// CROSS-SECTION SUPPORT
// =====================================================================
module crosssection(half_space) {
    if (!crosssection_view) {
        children();
    } else {
        intersection() {
            children();
            if (crosssection_axis == "x")
                translate([crosssection_pos, -half_space, -half_space])
                    cube([half_space * 2, half_space * 2, half_space * 2]);
            if (crosssection_axis == "y")
                translate([-half_space, crosssection_pos, -half_space])
                    cube([half_space * 2, half_space * 2, half_space * 2]);
            if (crosssection_axis == "z")
                translate([-half_space, -half_space, crosssection_pos])
                    cube([half_space * 2, half_space * 2, half_space * 2]);
        }
    }
}

// =====================================================================
// DEBUG: visualize hex nuts in their pockets
// =====================================================================
module debug_nuts() {
    nut_r = nut_af / 2 / cos(30);
    color("green", 0.7)
        for (pos = bolt_positions) {
            rot = (pos[1] > 0) ? 15 : -15; // mirror matches collar's mirror([0,m,0])
            translate([nut_x, pos[1], pos[0]])
                rotate([0, 90, 0])
                    rotate([0, 0, rot])
                        cylinder(h=nut_thickness, r=nut_r, $fn=6, center=true);
        }
}

// =====================================================================
// DEBUG: visualize bolts in their holes
// =====================================================================
module debug_bolts() {
    head_start_x = outer_extent - head_height;
    color("yellow", 0.7)
        for (pos = bolt_positions) {
            // Shaft
            translate([head_start_x - bolt_length, pos[1], pos[0]])
                rotate([0, 90, 0])
                    cylinder(h=bolt_length, d=bolt_dia, center=false);
            // Socket head
            translate([head_start_x, pos[1], pos[0]])
                rotate([0, 90, 0])
                    cylinder(h=head_height, d=head_dia, center=false);
        }
}
