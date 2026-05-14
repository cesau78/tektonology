// --- Bumper bracket — shell envelope + shell_wedge (#8 wood bores); sizing keyed to kneeler+tread envelopes.
preview = true;

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

// QR↔wedge envelope rule: (plate + bumper height) + optional half tread width along shell_extent_qr_wedge_mm.
width_extra_half_tread = true;

// Pew engagement depth along +Y (shell_face_pew lies at y = shell_extent_tread_pew_mm).
depth_in            = 3;

// ── Shell ────────────────────────────────────────────────────────────────────
wall                = 3;
corner_r            = 1;
epsilon             = 0.02;    // manifold + thin slabs

/*
  Canonical bracket coordinates (before bracket_rotate_x_deg export rotation).

  Nominal exterior corner at QR ∩ tread ∩ bottom (corner_r minkowski rounds afterward).

  Axes:
    +X : QR face (−X outward normal from solid) toward wedge outer façade (+X outward normal).
    +Y : tread face (−Y outward) toward pew face (+Y outward).
    +Z : bottom (−Z outward) toward insertion roof (+Z outward); shell_wedge attaches at z = shell_height_mm.

  Exterior faces (outward normals):
    shell_face_qr               −X   narrower envelope (QR label).
    shell_face_wedge_outer       +X   vertical façade of shell_wedge prism (hypotenuse rises +Z along +X run).
    shell_face_tread             −Y   tread / bumper side (Y-axis mate opposite pew).
    shell_face_pew               +Y   pew contact (shell_extent_tread_pew_mm equals depth_in × 25.4).
    shell_face_bottom            −Z   footprint before orientation lift.
    shell_face_insertion_roof    +Z   roof plane before wedge tip; wedge footprint sits here.

  Physical rectangles: ±Y faces span shell_extent_qr_wedge_mm × shell_height_mm (larger pair).
                       ±X faces span shell_extent_tread_pew_mm × shell_height_mm (narrower pair).

  Label check: larger pew vs tread mate uses the ±Y pair (shell_face_tread ↔ shell_face_pew).
               narrower QR vs wedge façade uses ±X (shell_face_qr ↔ shell_face_wedge_outer).
               If print labeling swapped axes versus this canonical frame, compare against bracket_rotate_x_deg export.
*/

// ── Shell wedge (roof prism + overlap slab); apex rises along +Z toward +X rim ────────────────────
shell_wedge_leg_mm        = 28;      // apex height along prism hypotenuse; drives bore tilt + plastic path math.

// Three wedge screw bores along +Y at these fractions of shell inset tread–pew span.
hole_y_frac         = [1/6, 1/2, 5/6];

// ── Computed overall box (exterior rule box before minkowski; wedge adds above roof) ─────────────────────
tread_l             = sole_plate_l + tread_tightness;
tread_w             = sole_plate_w + tread_tightness;
core_depth          = socket_depth + core_protrusion;
radius              = socket_depth / 2;
// Approximate tread max vertical span (core + ribs + flange minkowski), conservative
tread_z_span        = (socket_depth/2 + core_depth/2) - (-core_protrusion/2 - radius)
                      + flange_depth + 4;
shell_extent_qr_wedge_mm =
    bracket_plate_t + bumper_h + (width_extra_half_tread ? tread_w / 2 : 0);
shell_extent_tread_pew_mm = depth_in * 25.4;
shell_height_mm           = tread_z_span + 2 * side_margin_each_mm;

// Midplane of shell_height_mm (tread flip pivot height & exploded vertical alignment reference).
shell_midplane_z_mm = shell_height_mm / 2;

// Exploded tread mate (canonical bracket coords): XY centers on inset core midplanes once those exist below.
// Z: assembly_tread_slide_z is chosen after flange groove slabs exist so flange apex aligns with groove pocket slab top (see tread_groove_pocket_* + assembly_pose block below).
function tread_visual_mean_z_local() = let (
    pi = acos(-1),
    ribs_n = 10,
    z_core = socket_depth / 2,
    vol_core = tread_l * tread_w * core_depth,
    z_rib = -core_protrusion / 2,
    vol_rib = pi * pow(radius, 2) * tread_w,
    vol_ribs = ribs_n * vol_rib,
    fl_l = sole_plate_l + groove_overhang * 2 - flange_clearance,
    fl_w = sole_plate_w + groove_overhang * 2 - flange_clearance,
    z_fl = socket_depth / 2 + core_depth / 2 - flange_depth / 2 - 1,
    vol_fl = fl_l * fl_w * (flange_depth + 2),
    vt = vol_core + vol_ribs + vol_fl
) (vol_core * z_core + vol_ribs * z_rib + vol_fl * z_fl) / vt;

// Local Z extents of tread_visual_for_exploded_view() union (conservative bbox vs ribs/core/flange).
function tread_visual_z_bounds_local() = let (
    z_core_lo = socket_depth / 2 - core_depth / 2,
    z_core_hi = socket_depth / 2 + core_depth / 2,
    z_rib_lo = -core_protrusion / 2 - radius,
    z_rib_hi = -core_protrusion / 2 + radius,
    z_fl_c = socket_depth / 2 + core_depth / 2 - flange_depth / 2 - 1,
    z_fl_lo = z_fl_c - flange_depth / 2 - 2,
    z_fl_hi = z_fl_c + flange_depth / 2 + 2
) [
    min(z_core_lo, z_rib_lo, z_fl_lo),
    max(z_core_hi, z_rib_hi, z_fl_hi)
];

function tread_visual_z_span_mm() = let (b = tread_visual_z_bounds_local()) b[1] - b[0];

// Whole bracket world rotation about X through bottom-face center `(shell_extent_qr_wedge_mm/2, shell_extent_tread_pew_mm/2, 0)`. 0 = legacy Z-up export.
// After rotation, geometry is lifted along world +Z so min(Z) ≈ 0 (bounding-corner estimate for Rx spins).
bracket_rotate_x_deg = 0;

// Cross-section clip in canonical bracket coords (slice before bracket_rotate_x_deg). STL export normally keeps bracket_cross_section = false.
bracket_cross_section = false;
// "x" keeps X≥pos half; "y" keeps Y≥pos; "z" keeps Z≥pos (same convention as prayer-sole tread.scad crosssection_*).
bracket_cross_axis = "y";
bracket_cross_offset = 0;              // shifts cut plane along axis (mm); 0 centers on shell_extent_* / shell_height_mm midplanes per axis letter.

// Shell inset rectangular core (between rounded vertical edges): spans QR↔wedge and tread↔pew minus corner offsets.
shell_inset_dim_qr_wedge_mm    = shell_extent_qr_wedge_mm - 2 * corner_r;
shell_inset_dim_tread_pew_mm   = shell_extent_tread_pew_mm - 2 * corner_r;
// Horizontal roof leg along +X from inset QR corner toward wedge rim (hypotenuse ground projection).
shell_wedge_hypotenuse_run_mm  = shell_inset_dim_qr_wedge_mm;

// Tread ghost / flip pivot XY: center on inset shell core midplanes (tread↔pew and QR↔wedge); same numeric half as shell_extent_* / 2 when corner_r is symmetric.
assembly_tread_center_qr_wedge_mm    = corner_r + shell_inset_dim_qr_wedge_mm / 2;
assembly_tread_center_tread_pew_mm   = corner_r + shell_inset_dim_tread_pew_mm / 2;

// Groove / flange metrics (tread.scad); pocket below uses groove_l / groove_w; assembly preview uses same for tread ghost.
groove_h            = socket_depth / 4;
groove_l            = sole_plate_l + (groove_overhang * 2) - flange_clearance;
groove_w            = sole_plate_w + (groove_overhang * 2) - flange_clearance;
bottom_socket_h     = socket_depth;

// Sphere on slide-in flange matches prayer-sole tread_positive() / tread_visual (keep in sync).
tread_visual_flange_sphere_r  = 1.0;

// Rectangular pocket into shell (shell_face_tread −Y) for sole groove/flange; X uses groove_w / shell_extent_qr_wedge_mm; Y uses tread_groove_pocket_inward_y_mm.
tread_groove_shell_pocket_enabled = true;
// Inward +Y depth from nominal tread face (y ≈ 0): shell_extent_tread_pew_mm − (shell_extent_tread_pew_mm − groove_l) / 2 ≡ (shell + groove_l)/2.
tread_groove_pocket_inward_y_mm =
    shell_extent_tread_pew_mm - (shell_extent_tread_pew_mm - groove_l) / 2;
// Break through exterior rounding so the mouth is visibly open from shell_face_tread (nominal y ≈ 0 region).
tread_groove_pocket_break_tread_face_mm = corner_r + 1;
tread_groove_pocket_z_clear_mm = 0.25;
// Global +Z pocket floor. Pre-minkowski shell core bottom lies at z = corner_r (see shell_envelope_minkowski_union).
// Stack 2× flange_depth (2.5 mm at default socket_depth = 5) *above that plane* so bottom minkowski (sphere corner_r) doesn’t consume the intended margin from the physical bed face at z ≈ 0.
tread_groove_pocket_z_above_shell_core_floor_mm = 2 * flange_depth;
tread_groove_pocket_z0_mm =
    corner_r + tread_groove_pocket_z_above_shell_core_floor_mm;
tread_groove_pocket_height_mm =
    flange_depth + 2 * tread_visual_flange_sphere_r + tread_groove_pocket_z_clear_mm;

// Assembly pose (needs tread_groove_pocket_* + tread_visual_flange_sphere_r). Flip-chain bracket Z after apply_tread_cutout_flip satisfies
//   bracket_z(flange apex) = 2*shell_midplane_z − slide_cz + z_fl_top_local + socket_depth/2
// (see tread_mated_to_bracket_reference in assembly.scad). Mate flange apex flush with flange groove slab top (cuboid +Z ceiling).
function assembly_tread_vertical_auto_mm() = 0;
assembly_tread_z_trim_mm = 0;

function assembly_tread_flange_top_local_z_mm() =
    socket_depth / 2 + core_depth / 2 - 1 + tread_visual_flange_sphere_r;

function assembly_bracket_flange_groove_top_z_mm() =
    tread_groove_pocket_z0_mm + tread_groove_pocket_height_mm;

assembly_tread_slide_z =
    2 * shell_midplane_z_mm
    + assembly_tread_flange_top_local_z_mm()
    + socket_depth / 2
    - assembly_bracket_flange_groove_top_z_mm();

// Pull-apart in canonical coords; [0,0,0] = mated overlap (groove flange Z keyed by slide_z above).
exploded_tread_offset_pull = [0, 0, 0];

// Smaller prism under flange slot for tread rigid core (footprint tread_l × tread_w).
tread_core_shell_pocket_enabled = true;
// Inward +Y from tread face — same pairing as flange pocket, with tread_l ⇄ groove_l.
tread_core_pocket_inward_y_mm =
    shell_extent_tread_pew_mm - (shell_extent_tread_pew_mm - tread_l) / 2;
// Canonical +Z: ceiling = flange pocket floor tread_groove_pocket_z0_mm. Pockets subtract AFTER minkowski(sphere(corner_r)), so rounding adds solid z in [0, corner_r] under the inset cube bottom; core floor datum = tangent shell_face_bottom (z = corner_r - corner_r = 0) with −4 epsilon breakout for booleans.
tread_core_pocket_floor_z_mm   = -4 * epsilon;
tread_core_pocket_ceiling_z_mm = tread_groove_pocket_z0_mm;
tread_core_pocket_depth_z_mm =
    tread_core_pocket_ceiling_z_mm - tread_core_pocket_floor_z_mm;
// Deprecated names — same as floor / depth_z (legacy references in previews or forks).
tread_core_pocket_z0_mm           = tread_core_pocket_floor_z_mm;
tread_core_pocket_height_z_mm      = tread_core_pocket_depth_z_mm;

// ── Pew leg + hypoten-mount wood fasteners (after shell extents exist) ────────
// Stock the screws bite into — here 1½" nominal leg thickness (face grain).
pew_leg_thickness_in     = 1.5;
pew_leg_thickness_mm     = pew_leg_thickness_in * 25.4;

// #8 wood / structural trim screws (nominal major Ø ~0.164"); clearance in print.
wood_screw_gauge         = 8;
wood_shank_nominal_mm    = 4.17;
wood_shank_clr           = wood_shank_nominal_mm + 0.92;   // sliding fit + angled drive
wood_head_diameter       = 10;                              // Ø for flat or trim‑washer head flare
wood_countersink_depth_mm = 4.5;                            // model depth toward wood for head recess
screw_chamfer_lip_mm     = 0.65;                             // flare added to Ø for printed chamfer clearance

// Max solid printed path ⟂ angled bore (~ legs shell_wedge_hypotenuse_run_mm × shell_wedge_leg_mm).
plastic_along_bore_mm =
    shell_wedge_hypotenuse_run_mm * shell_wedge_leg_mm
    / sqrt(pow(shell_wedge_hypotenuse_run_mm, 2) + pow(shell_wedge_leg_mm, 2));

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
  • With prism run≈shell_wedge_hypotenuse_run_mm and leg shell_wedge_leg_mm, path along the bore is
    plastic_along_bore_mm (~ run·L / sqrt(run²+L²)).
  • For a 1½" (≈38 mm) leg: target ~⅞″–1¼″ (22–32 mm) of thread in SOLID stock so the
    tip does not exit — use recommended_screw_length_mm above as a guide.
  • Typical pick: **#8 × 2¼" (57 mm)** or **#8 × 2" (51 mm)** trim / cabinet / GRK‑style screws;
    soft pine may use shorter; cranky oak may use longer only if angled path stays in meat.
  • Pilot: softwood ~7/64″ (≈2.75 mm); hardwood ~9/64″ (≈3.57 mm).
*/

// Rough filament check (SolidWorks / slicer is authoritative):
// Outer rule box volume ≈ shell_extent_qr_wedge_mm × shell_extent_tread_pew_mm × shell_height_mm.
// Shell wedge prism above roof; wedge volume ~ ½ × shell_extent_qr_wedge_mm × shell_wedge_leg_mm × shell_extent_tread_pew_mm (pre-rounding).
