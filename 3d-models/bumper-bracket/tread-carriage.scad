// --- BUMPER BRACKET — TREAD CARRIAGE ---
// Sub-volume of the bumper bracket shell, carved out by tread_carriage_*_mm bounds
// in config.scad (absolute bracket X/Y/Z). Tune those variables to choose what
// stays in bumper-bracket.scad vs what prints as this carriage piece.
//
// Modeled in the bracket coordinate frame (same as bumper-bracket.scad).
// Standalone export rests the selection cube's −Z face on the build plate.

render_standalone_export = false;   // suppress bumper-bracket.scad root emit
include <bumper-bracket.scad>

$fn = preview ? 32 : 64;

tread_carriage_emit_if_root = is_undef(tread_carriage_suppress_root) ? true : !tread_carriage_suppress_root;

if (tread_carriage_emit_if_root)
    tread_carriage_export_bed_lift()
        tread_carriage();
