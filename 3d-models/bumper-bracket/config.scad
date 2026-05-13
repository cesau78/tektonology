// --- Bumper bracket + cap — sizing for pew mount + tread slide-in ---
// Tread cavity matches prayer-sole v3 tread.scad groove/socket pattern.

preview = false;

// ── Kneeler reference (defaults; override with -D) ───────────────────────────
bracket_plate_t     = 5;       // kneeler-bracket.scad plate_t
bumper_h            = 23.8;    // kneeler-bumper.scad height

// ── Tread / sole (match prayer-sole v3-compound-fastened) ───────────────────
tread_tightness     = 0.1;     // matches tolerance in tread.scad
sole_plate_l        = 53;
sole_plate_w        = 18.5;
groove_overhang     = 2;

// Tread core / flange (from tread.scad)
socket_depth        = 5;
core_protrusion     = 2;
flange_clearance    = 0.2;
flange_depth        = socket_depth / 4;

// ── User exterior rules ─────────────────────────────────────────────────────
// Height: tread bounding Z + 1/2" on each side (25.4 mm total added)
side_margin_each_in = 0.5;
side_margin_each_mm = side_margin_each_in * 25.4;

// Width: (plate thickness + bumper height) + 1/2 * tread width
width_extra_half_tread = true;

// Depth of main rectangular block (pew face is at +depth along Y)
depth_in            = 3;

// ── Shell ────────────────────────────────────────────────────────────────────
wall                = 3;
corner_r            = 1;
epsilon             = 0.02;    // manifold + thin slabs (tread groove, etc.)

// ── Roof mount prism (triangular wedge, XY slab matches shell inset core) ────────────────────
mount_leg_mm        = 28;      // +Z vertical leg; horizontal roof run drives hyp_xz + plastic math below.

// Three holes evenly along roof hypotenuse (s ∈ [0,1])
hole_s_frac         = [1/6, 1/2, 5/6];

// ── Cap (single M3 BHCS) ─────────────────────────────────────────────────────
cap_split_y         = 8;       // overlap depth (mm) engaging shell + lip
bolt_diameter       = 3.4;
bolt_head_diameter  = 6.8;
bolt_head_height    = 3.6;
nut_af              = 5.7;
nut_thickness       = 2.5;
cap_wall            = 3;

// ── Computed overall box (exterior, before wedge union) ─────────────────────
tread_l             = sole_plate_l + tread_tightness;
tread_w             = sole_plate_w + tread_tightness;
core_depth          = socket_depth + core_protrusion;
radius              = socket_depth / 2;
// Approximate tread max vertical span (core + ribs + flange minkowski), conservative
tread_z_span        = (socket_depth/2 + core_depth/2) - (-core_protrusion/2 - radius)
                      + flange_depth + 4;
width_outer         = bracket_plate_t + bumper_h + (width_extra_half_tread ? tread_w / 2 : 0);
depth_mm            = depth_in * 25.4;
height_outer        = tread_z_span + 2 * side_margin_each_mm;

// Prism pre-Minkowski: hull() inset roof slab → thin ε ridge tab at outer +width_outer (−X leg = core width).
mount_wedge_width_core    = width_outer - 2 * corner_r;
mount_wedge_depth_core    = depth_mm - 2 * corner_r;
// Horizontal roof leg **corner_r → width_outer − corner_r** (matches flush wedge + shell inset).
mount_wedge_hyp_run_x     = mount_wedge_width_core;

// Groove cavity (same idea as collar bottom groove in config.scad)
groove_h            = socket_depth / 4;
groove_l            = sole_plate_l + (groove_overhang * 2) - flange_clearance;
groove_w            = sole_plate_w + (groove_overhang * 2) - flange_clearance;
bottom_socket_h     = socket_depth;

// ── Pew leg + hypoten-mount wood fasteners (after width_outer exists) ────────
// Stock the screws bite into — here 1½" nominal leg thickness (face grain).
pew_leg_thickness_in     = 1.5;
pew_leg_thickness_mm     = pew_leg_thickness_in * 25.4;

// #8 wood / structural trim screws (nominal major Ø ~0.164"); clearance in print.
wood_screw_gauge         = 8;
wood_shank_nominal_mm    = 4.17;
wood_shank_clr           = wood_shank_nominal_mm + 0.92;   // sliding fit + angled drive
wood_head_diameter       = 10;                              // Ø for flat or trim‑washer head flare
wood_countersink_depth_mm = 4.5;                            // model depth toward wood for head recess

// Max solid printed path ⟂ angled bore (~ right triangle legs mount_wedge_hyp_run_x × mount_leg_mm).
plastic_along_bore_mm =
    mount_wedge_hyp_run_x * mount_leg_mm
    / sqrt(pow(mount_wedge_hyp_run_x, 2) + pow(mount_leg_mm, 2));

// Target thread penetration into solid wood (~1″) but stay comfortably inside 1½″ leg.
tip_breakout_margin_mm  = 25.4 * 7 / 32;                     // ~7/16″ shy of opposite face / split line
target_thread_in_wood_mm = let (
    raw = pew_leg_thickness_mm - tip_breakout_margin_mm,
    floors = min(pew_leg_thickness_mm * 0.66, pew_leg_thickness_mm - 11)
) raw > 28 ? raw : floors; // thin legs: clamp to conservative thread depth

// Shank length → plastic path + usable thread (+ head flare not counting tip).
recommended_screw_length_mm = ceil(
    plastic_along_bore_mm + target_thread_in_wood_mm +
    wood_countersink_depth_mm + 2);

// Modeled axial hole (plastic + pew + fudge) — through bore for STL / slicing.
wood_bored_axial_mm =
    ceil(plastic_along_bore_mm + pew_leg_thickness_mm + plastic_along_bore_mm / 5 + 8);

/*
  Length advice (manual install):
  • With prism run≈mount_wedge_hyp_run_x and leg mount_leg_mm, path along the bore is
    plastic_along_bore_mm (~ run·L / sqrt(run²+L²)).
  • For a 1½" (≈38 mm) leg: target ~⅞″–1¼″ (22–32 mm) of thread in SOLID stock so the
    tip does not exit — use recommended_screw_length_mm above as a guide.
  • Typical pick: **#8 × 2¼" (57 mm)** or **#8 × 2" (51 mm)** trim / cabinet / GRK‑style screws;
    soft pine may use shorter; cranky oak may use longer only if angled path stays in meat.
  • Pilot: softwood ~7/64″ (≈2.75 mm); hardwood ~9/64″ (≈3.57 mm).
*/

// ── Derived cap extents (needs height_outer, wall, epsilon, cap_split_y, cap_wall) ──
cap_inner_h         = height_outer - 2 * wall - epsilon * 2;
cap_x_ext           = cap_split_y + cap_wall;

// Rough filament check (SolidWorks / slicer is authoritative):
// Outer box-only volume ≈ width_outer × depth_mm × height_outer.
// Mount triangular prism above roof; wedge volume ~ ½ × width_outer × mount_leg_mm × depth_mm (pre-rounding).
