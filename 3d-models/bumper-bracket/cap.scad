// --- BUMPER BRACKET — TREAD RETENTION CAP ---
// Closes the −Z tread-slot mouth (face D) so the back-to-back treads cannot slide
// out. Rather than a slab projecting past the mouth, the cap is a flush plug: the
// bracket carries a rectangular "cube hull" recess in the gap below the seated
// treads and the cap fills it flush with the existing profile. Held by one central
// M3×20 socket-head cap screw whose head seats in the cap and whose shaft threads
// into a hex nut captured in the bracket body behind the inner tread (see
// config.scad / bumper-bracket.scad). Mirrors the prayer-sole v3 fastener pattern
// with a single central bolt.
//
// Modeled in the bracket coordinate frame (same as bumper-bracket.scad), so in the
// assembly the cap drops into the recess with no extra transform. Standalone it is
// laid outer-face-down on the bed for printing.

render_standalone_export = false;   // suppress bumper-bracket.scad root emit
include <bumper-bracket.scad>

$fn = preview ? 32 : 64;

// Root emit unless an includer (assembly.scad) suppresses it.
cap_emit_if_root = is_undef(cap_suppress_root) ? true : !cap_suppress_root;

// Through-shaft + socket-head recess, cut from the cap's outer (−Z / mouth) face.
module tread_cap_bolt_hole() {
    shaft_d = cap_bolt_dia + cap_bolt_clearance;
    head_d  = cap_head_dia + cap_head_clearance + 0.1;
    z_outer = tread_cap_outer_z_mm();
    shaft_h = (tread_cap_recess_z_hi_mm() - z_outer) + epsilon * 8;
    translate([cap_bolt_x_mm, cap_bolt_y_mm(), z_outer - epsilon * 4]) {
        cylinder(h = shaft_h, d = shaft_d);
        cylinder(h = cap_head_height + epsilon * 4, d = head_d);
    }
}

// Flush plug: the recess volume (shrunk by the fit clearance) intersected with the
// beveled body solid, so the cap is solid across the slot opening (stops the
// treads) while matching the bracket's beveled top and rounded mouth faces.
module tread_cap() {
    difference() {
        intersection() {
            shell_solid_no_tread_pockets();
            tread_cap_recess_volume(cap_fit_clearance_mm);
        }
        tread_cap_bolt_hole();
    }
}

// Standalone: lay the cap outer face on the bed (head pocket opens downward).
if (cap_emit_if_root)
    translate([0, 0, -tread_cap_outer_z_mm()])
        tread_cap();
