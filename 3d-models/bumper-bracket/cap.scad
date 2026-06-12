// --- BUMPER BRACKET — TREAD RETENTION CAP (separate print) ---
// Only used when tread_cap_separate_print = true in config.scad. By default the
// cap is fused into bumper-bracket.scad (tread_cap_separate_print = false).
//
// Modeled in the bracket coordinate frame. Standalone export lays the outer
// face (−Z / tread-slot mouth) on the build plate.

render_standalone_export = false;   // suppress bumper-bracket.scad root emit
include <bumper-bracket.scad>

$fn = preview ? 32 : 64;

cap_emit_if_root = is_undef(cap_suppress_root) ? true : !cap_suppress_root;

if (cap_emit_if_root)
    translate([0, 0, -tread_cap_outer_z_mm()])
        tread_cap();
