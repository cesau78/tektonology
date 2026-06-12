// Right bumper bracket — mirror image of bumper-bracket.scad (the left bracket).
//
// The default body in bumper-bracket.scad is the LEFT bracket: it mounts on the
// RIGHT side of a pew leg. This file is its mirror twin, the RIGHT bracket, which
// mounts on the LEFT side of a pew leg.
//
// Handedness lives on the bracket X axis (the QR/kneeler ↔ wedge width): the
// sloped roof, the +X pew-mount block, and the angled #8 wood-screw bores are all
// laterally offset toward the +X (leg-contact, face A) side. Reflecting across X
// (mirror([1, 0, 0])) moves that whole leg-mount hand to the opposite side while
// leaving the pew-engagement face (+Z, C) and tread-slot mouth (−Z, D) pointing
// the same way — exactly the difference between the two sides of a leg.
//
// The tread slot/pockets, the wood-screw spacing, the M3 hardware, and the
// retention cap are all reused as-is. The cap is very slightly X-asymmetric (the
// wedge/mount-block bias the rounding by ~0.7 x 0.5 mm at one -Z mouth corner),
// but an interference check shows the left cap drops into the mirrored recess with
// zero clash — the difference is only a sub-mm cosmetic gap at that corner, so the
// same cap.scad serves both hands.
//
// Export note: bumper_bracket() already applies bracket_export_bed_lift() (a Z-only
// translate), and mirror([1, 0, 0]) commutes with it, so min-Z still rests on the
// build plate.

BUMPER_BRACKET_INCLUDED_BY = true;
include <bumper-bracket.scad>

mirror([1, 0, 0])
    bumper_bracket();
