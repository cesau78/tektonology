// --- TEKTONOLOGY KNEELER BOOT COUPLER (2-Piece) ---
// A slipper slides over the steel kneeler foot from one end, then a cap bolts
// onto the hidden end to lock it in place. Two M3 socket-head cap screws sit
// horizontally in the side walls; hardware faces the wall so worshipers never see it.
//
// The slipper's top lip extends over the cap on both long sides, creating an
// interlocking overlap. The cap only has lip material on its far short end,
// filling the gap between the slipper's overhanging lips.
//
// Sections:
// 1) Top socket — fits the metal leg with beveled/rounded walls
// 2) Bottom socket — fits the TPU insert with flat walls for secure press-fit
include <kneeler-boot-config.scad>

// --- Piece Selection ---
piece = "assembly"; // "slipper", "cap", or "assembly"

// --- Shell Geometry ---
wall = 8.0; // thicker walls to house M3 hardware in the side walls
floor_thickness = 3.0; // thickness of the shell floor under the bottom socket
top_target_depth = 2;
bottom_target_depth = 6.35;
total_h = top_target_depth + bottom_target_depth + floor_thickness;
r = 2.0;
$fn = preview ? 32 : 64;

// --- Lip Parameters ---
enable_top_lip = true;
lip_inset = 1;
lip_thickness = 3;

// --- Two-Piece Split ---
cap_thickness = 8; // along X axis
split_x = (leg_l / 2) + wall - r - cap_thickness;

// --- Derived ---
outer_extent = (leg_l / 2) + wall; // half-length of outer shell after minkowski
cap_width = leg_w + (groove_overhang * 2) + 4; // cap Y width matches bottom groove (including minkowski)
// Lip ring inner opening dimensions (used for lip splitting)
lip_inner_x = leg_l - 2 - (2 * lip_inset);
lip_inner_y = leg_w - 2 - (2 * lip_inset);

// --- M3x30 Socket Head Cap Screw Hardware ---
bolt_dia        = 3.0;
bolt_clearance  = 0.1;
bolt_length     = 30;    // M3x30 — shaft length under head (very common size)
nut_af          = 5.5;   // hex nut across-flats
nut_clearance   = 0.2;
nut_thickness   = 2.4;
head_dia        = 5.5;   // M3 socket head cap screw head diameter
head_clearance  = 0.0;
head_height     = 3.0;   // M3 socket head height

// Nut X position: derived so bolt tip fully engages the nut with 0.5mm margin
// bolt shaft starts at outer_extent - head_height, tip = start - bolt_length
nut_x = (outer_extent - head_height) - bolt_length + (nut_thickness / 2) + 0.5;

// Bolt position: two screws aligned with cap side bosses (Y = ±cap_width/2)
bolt_z = (bolt_dia / 2) + 0.5; // bottom of bolt hole 0.5mm above z=0
bolt_positions = [[bolt_z, cap_width / 2], [bolt_z, -cap_width / 2]];

// --- Cap Side Bosses ---
boss_dia       = head_dia;    // matches cap screw head diameter
boss_height    = head_height; // adjust with screw availability
boss_clearance = 0.3;

// --- Alignment Tongue ---
tongue_width     = 10;   // along Y
tongue_height    = 6;    // along Z
tongue_depth     = 1.5;  // protrusion along X
tongue_clearance = 0.15;

// =====================================================================
// COUPLER SHELL — outer shell + sockets, WITHOUT the top lip
// =====================================================================
module coupler_shell() {
    module inner_cuts() {
        // TOP SOCKET (Metal Leg) — beveled/rounded walls
        translate([0, 0, (total_h / 2) - (top_target_depth / 2) + 0.1])
            minkowski() {
                cube([leg_l - 2, leg_w - 2, top_target_depth], center=true);
                sphere(r=1.0);
            }

        // BOTTOM SOCKET (TPU Plug) — flat walls
        translate([0, 0, -(total_h / 2) + (bottom_target_depth / 2) - 0.1])
            cube([leg_l, leg_w, bottom_target_depth + 0.2], center=true);

        // BOTTOM SOCKET SLIDE GROOVE — rounded, wider than socket for slide-in rail
        // 1/4 socket depth, extends groove_overhang beyond socket on each side
        groove_h = bottom_target_depth / 4;
        // Top of groove aligns to top of bottom socket
        translate([0, 0, -(total_h / 2) + bottom_target_depth - (groove_h / 2) - 1])
            minkowski() {
                cube([
                    leg_l + (groove_overhang * 2) - 2,
                    leg_w + (groove_overhang * 2) - 2,
                    groove_h
                ], center=true);
                sphere(r=1.0);
            }
    }

    difference() {
        minkowski() {
            cube([
                leg_l + (wall * 2) - (r * 2),
                leg_w + (wall * 2) - (r * 2),
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
    translate([0, 0, (total_h / 2) - (top_target_depth / 2) + 0.1])
        minkowski() {
            cube([leg_l - 2, leg_w - 2, top_target_depth], center=true);
            sphere(r=1.0);
        }
}

// =====================================================================
// TOP LIP — standalone module (full rectangular ring)
// =====================================================================
module top_lip() {
    lip_r = 1.0; // Minkowski rounding radius for lip
    // Positioned so flat bottom overlaps shell top by lip_r for bonded fit
    lip_z = (total_h / 2) - lip_r + (lip_thickness / 2);
    cut_z = lip_z - (lip_thickness / 2); // flat bottom plane
    outer_x = leg_l + wall;
    outer_y = leg_w + wall;

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
                    cube([leg_l - 2, leg_w - 2, 0.01], center=true);
                    sphere(r=lip_r);
                }
        }
        // Remove bottom Minkowski rounding for flat bonded fit to slipper
        translate([-big, -big, cut_z])
            cube([big * 2, big * 2, big * 2]);
    }
}

// =====================================================================
// SPLIT LIP MODULES
// The slipper lip is a U-shape: both long sides + the slipper's short end,
// extending over the cap zone. The cap lip is just the far short-end bar.
// =====================================================================
big = 200;

// Slipper lip: full ring MINUS the far short-end bar (cap's portion).
// Keeps both long-side bands (full X length) + the slipper-side short end.
module slipper_lip() {
    intersection() {
        top_lip();
        union() {
            // Everything up to the inner edge of the far short end
            translate([-big, -big, -big])
                cube([big + lip_inner_x / 2, big * 2, big * 2]);
            // Plus the two long-side bands extending full length over the cap
            // +Y band: y > lip_inner_y/2
            translate([-big, lip_inner_y / 2, -big])
                cube([big * 2, big, big * 2]);
            // -Y band: y < -lip_inner_y/2
            translate([-big, -big - lip_inner_y / 2, -big])
                cube([big * 2, big, big * 2]);
        }
    }
}

// Cap lip: only the far short-end bar between the slipper's overhanging lips.
// x > lip_inner_x/2, |y| < lip_inner_y/2
module cap_lip() {
    intersection() {
        top_lip();
        translate([lip_inner_x / 2, -lip_inner_y / 2, -big])
            cube([big, lip_inner_y, big * 2]);
    }
}

// =====================================================================
// FASTENER GEOMETRY
// =====================================================================

// Hex nut pocket — centered at nut_x in the slipper body (near assembled midpoint).
module hex_nut_pocket(z_pos, y_pos) {
    nut_r = (nut_af + nut_clearance) / 2 / cos(30);
    pocket_depth = nut_thickness + 0.2;

    translate([nut_x - pocket_depth / 2, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=pocket_depth, r=nut_r, $fn=6);
}

// Hex nut slide-in slot — 45° toward center from nut pocket through shell.
module hex_nut_slot(z_pos, y_pos) {
    slot_width = nut_af + nut_clearance;
    pocket_depth = nut_thickness + 0.2;
    slot_h = total_h; // generous length to exit the shell
    angle = (y_pos > 0) ? -60 : 60; // tilt toward Y=0

    translate([nut_x, y_pos, z_pos])
        rotate([angle, 0, 0])
            translate([-pocket_depth / 2, -slot_width / 2, -slot_h])
                cube([pocket_depth, slot_width, slot_h]);
}

// Bolt channel through the slipper — connects the split face to the nut pocket.
module bolt_channel(z_pos, y_pos) {
    hole_dia = bolt_dia + bolt_clearance;
    // From split face (+ 1mm overshoot) to past the nut pocket
    channel_start = nut_x - nut_thickness / 2 - 1;
    channel_length = split_x - channel_start + 1;

    translate([channel_start, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=channel_length, d=hole_dia);
}

// Bolt through-hole + socket head recess in the cap piece.
module bolt_hole(z_pos, y_pos) {
    hole_dia = bolt_dia + bolt_clearance;
    head_pocket_dia = head_dia + head_clearance;

    // Shaft hole through the full cap
    translate([split_x - 1, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=outer_extent - split_x + 2, d=hole_dia);

    // Socket head recess on the outer face (+X end)
    translate([outer_extent - head_height + 0.1, y_pos, z_pos])
        rotate([0, 90, 0])
            cylinder(h=head_height + 1, d=head_pocket_dia + 0.1);
}

// =====================================================================
// ALIGNMENT FEATURES
// =====================================================================

module alignment_tongue() {
    translate([split_x, -tongue_width / 2, -tongue_height / 2])
        cube([tongue_depth, tongue_width, tongue_height]);
}

module alignment_groove() {
    tw = tongue_width + (tongue_clearance * 2);
    th = tongue_height + (tongue_clearance * 2);
    td = tongue_depth + tongue_clearance;

    translate([split_x - 0.1, -tw / 2, -th / 2])
        cube([td + 0.1, tw, th]);
}

// =====================================================================
// HALF-SPACE helpers
// =====================================================================

module slipper_half_space() {
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

// Center Y band (material inside the socket footprint)
module center_band() {
    translate([-big, -leg_w / 2, -big])
        cube([big * 2, leg_w, big * 2]);
}

// =====================================================================
// CAP SIDE BOSSES — half-cylinders on each Y edge of the cap
// =====================================================================
module cap_side_bosses() {
    boss_len = outer_extent - split_x; // full cap depth along X
    for (side = [1, -1])
        translate([split_x + boss_len / 2, side * cap_width / 2, bolt_z])
            rotate([0, 90, 0])
                cylinder(h=boss_len, d=boss_dia, center=true);
}

// Matching cutouts in slipper side walls for the bosses
module cap_side_boss_holes() {
    boss_len = outer_extent - split_x;
    for (side = [1, -1])
        translate([split_x + boss_len / 2, side * cap_width / 2, bolt_z])
            rotate([0, 90, 0])
                cylinder(h=boss_len + 0.2, d=boss_dia + (boss_clearance * 2), center=true);
}

// =====================================================================
// FINAL PIECES
// =====================================================================

module slipper() {
    difference() {
        union() {
            // Slipper half of the shell
            intersection() {
                coupler_shell();
                slipper_half_space();
            }
            // Side walls extend full length over the cap zone
            intersection() {
                coupler_shell();
                cap_half_space();
                side_bands();
            }
            if (enable_top_lip) slipper_lip();
            //alignment_tongue();
        }
        // Hex nut pockets, slide-in slots, and bolt channels
        for (pos = bolt_positions) {
            hex_nut_pocket(pos[0], pos[1]);
            hex_nut_slot(pos[0], pos[1]);
            bolt_channel(pos[0], pos[1]);
        }
        // Boss cutouts in slipper side walls
        cap_side_boss_holes();
        // Re-cut top socket through lip
        if (enable_top_lip) top_socket_cut();
    }
}

module cap() {
    difference() {
        union() {
            // Cap width matches the bottom groove (wider than slipper center band)
            intersection() {
                coupler_shell();
                cap_half_space();
                translate([-big, -cap_width / 2, -big])
                    cube([big * 2, cap_width, big * 2]);
            }
            if (enable_top_lip) cap_lip();
            // Side bosses — half-cylinders at cap Y edges
            cap_side_bosses();
        }
        for (pos = bolt_positions)
            bolt_hole(pos[0], pos[1]);
        // Re-cut top socket through lip
        if (enable_top_lip) top_socket_cut();
        //alignment_groove();
    }
}

// =====================================================================
// RENDERING
// =====================================================================
module render_piece() {
    if (piece == "slipper")
        slipper();
    else if (piece == "cap")
        cap();
    else { // assembly — show both with a small gap
        slipper();
        translate([64, 0, 0]) cap(); // 16mm exploded gap for visibility
    }
}

// Debug: visualize hex nuts in their pockets
module debug_nuts() {
    nut_r = nut_af / 2 / cos(30);
    color("red", 0.7)
        for (pos = bolt_positions)
            translate([nut_x, pos[1], pos[0]])
                rotate([0, 90, 0])
                    cylinder(h=nut_thickness, r=nut_r, $fn=6, center=true);
}
//debug_nuts();

// Cross-section support
if (!crosssection_view) {
    render_piece();
} else {
    intersection() {
        render_piece();
        half_space = leg_l;
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
