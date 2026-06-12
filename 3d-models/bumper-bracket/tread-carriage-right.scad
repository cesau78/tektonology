// Right tread carriage — mirror of tread-carriage.scad (right bumper bracket hand).
//
// With a symmetric X selection cube (e.g. −15…+15) this is the same volume as the
// left hand; included for parity with bumper-bracket-right.scad exports.

BUMPER_BRACKET_INCLUDED_BY = true;
include <bumper-bracket.scad>

$fn = preview ? 32 : 64;

mirror([1, 0, 0])
    tread_carriage_export_bed_lift()
        tread_carriage();
