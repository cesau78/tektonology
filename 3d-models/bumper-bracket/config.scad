// --- Bumper bracket — shell envelope + shell_wedge (#8 wood bores); sizing keyed to kneeler+tread envelopes.
preview = true;

// ── Kneeler reference (defaults; override with -D) ───────────────────────────
// kneeler-bracket.scad — keep in sync with kneeler-bracket-visual.scad
bracket_plate_t                  = 5;       // kneeler-bracket plate_t
kneeler_bracket_plate_l_mm       = 145;
kneeler_bracket_plate_w_mm       = 34;
kneeler_bracket_corner_r_mm      = 5;
kneeler_bracket_peg_od_mm        = 9.4;
kneeler_bracket_peg_top_from_base_mm = 44.5; // plate bottom (z = 0) → peg top
kneeler_bracket_peg_h_mm         = kneeler_bracket_peg_top_from_base_mm - bracket_plate_t;
kneeler_bracket_peg1_inset_mm    = 18;
kneeler_bracket_peg2_inset_mm    = 18;    // far peg from +lx rim (bumper peg)
kneeler_bracket_support_h_mm     = 19.5;  // plate bottom → top of peg boss
kneeler_bracket_support_od_mm    = 16;
kneeler_bracket_screw_d_mm       = 5.2;
kneeler_bracket_csink_d_mm       = 10.5;
kneeler_bracket_csink_depth_mm   = 2.5;
kneeler_bracket_screw_x_frac     = [0.28, 0.5, 0.72];
kneeler_bracket_mirror_side      = false; // false = left, true = right (Y mirror)
bumper_h            = 23.8;    // kneeler-bumper.scad height

// kneeler-bushing.scad — keep in sync with kneeler-bushing-visual.scad
kneeler_bushing_total_height_mm = 24;
kneeler_bushing_id_mm           = 10;
kneeler_bushing_insert_od_mm    = 13.1;
kneeler_bushing_collar_height_mm = 6.3;
kneeler_bushing_collar_od_mm    = 16.2;

// kneeler-bumper.scad — keep in sync with kneeler-bumper-visual.scad
kneeler_bumper_od_mm        = 17.5;
kneeler_bumper_peg_od_mm    = 9.7;
kneeler_bumper_tightness_mm = 0.3;
kneeler_bumper_id_mm        = kneeler_bumper_peg_od_mm - kneeler_bumper_tightness_mm;

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
wall                = 3;     // solid infill inset (former hollow-shell cavity in bumper-parts.scad)
shell_solid_fill_enabled = true;  // union interior cube so the bracket prints solid, not as a thin wall
shell_hollow_walls_enabled = false; // true = legacy 3 mm wall cavity (difference inner cube)
corner_r            = 1;
epsilon             = 0.02;    // manifold + thin slabs

// Core + roof prism + pew mount pad unioned, then minkowski fillet; hull cutters subtract after.
shell_roof_prism_enabled  = true;
wood_screw_holes_enabled  = true;

/*
  Bracket coordinate frame — OpenSCAD (x, y, z) is the design frame for bumper-bracket.scad.
  The bracket body is never rotate()-reoriented. Optional bracket_lift_to_bed only translates
  along +Z for STL export (min Z on build plate).

  Origin: footprint center.
  +X: QR / kneeler side (−X) toward wedge and sloped roof (+X rim).
  +Y: shell height toward roof and wedge apex (lower Y = higher on the part).
  +Z: pew engagement (+Z rim); tread slot opens toward −Z.

  Sizing helpers (lx, ly, lz) use a corner-origin box aligned with extents below; bracket_pos()
  maps those into the centered bracket frame (defined after shell extents).
*/

// ── Shell wedge (roof prism + overlap slab); apex rises toward +X rim and lower bracket Y ───────
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

// Mid lz of shell_height_mm (sizing axis up); bracket Y = bracket_nat_y_mid_mm − lz.
shell_midplane_lz_mm = shell_height_mm / 2;

bracket_nat_y_mid_mm = (shell_height_mm + shell_wedge_leg_mm + corner_r) / 2;
shell_midplane_y_mm = bracket_nat_y_mid_mm - shell_midplane_lz_mm;

bracket_face_tread_slot_z_mm = -shell_extent_tread_pew_mm / 2;
bracket_face_pew_z_mm         = shell_extent_tread_pew_mm / 2;
bracket_face_wedge_x_mm       = shell_extent_qr_wedge_mm / 2;

// Corner-origin sizing (lx, ly, lz) → bracket OpenSCAD coordinates.
function bracket_pos(lx, ly, lz) = [
    lx - shell_extent_qr_wedge_mm / 2,
    bracket_nat_y_mid_mm - lz,
    ly - shell_extent_tread_pew_mm / 2,
];

// STL export: lift so lowest bracket Z sits on the build plate (translate only, not a rotation).
bracket_lift_to_bed = true;
shell_midplane_z_mm = shell_midplane_lz_mm; // alias for older scripts

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

// Side D (−Z tread slot): E bevel 9.8° (C∩E flush, D∩E inset); D∩F stays 90°.
tread_face_de_extra_angle_deg = 9.8;
function tread_face_e_bevel_slope_k() = tan(tread_face_de_extra_angle_deg);
// Y inset at D∩E for the nominal C↔D span (≈12.8 mm at default shell_extent_tread_pew_mm).
tread_face_d_e_side_y_narrow_mm = tread_face_e_bevel_slope_k() * shell_extent_tread_pew_mm;
function tread_face_de_cut_slope_deg() = tread_face_de_extra_angle_deg;

// Debug face labels (assembly preview only) — bracket OpenSCAD axes (x, y, z):
//   A = +X prism / wedge rim     B = −X opposite (narrow) rim
//   C = +Z pew engagement        D = −Z tread slot
//   E = +Y base (sizing lz → 0)  F = −Y roof / wedge apex
bumper_bracket_debug_face_labels_enabled = false;
bumper_bracket_debug_label_font = "Liberation Sans:style=Bold";
bumper_bracket_debug_label_size_mm = 12;
bumper_bracket_debug_label_offset_mm = 8;
bumper_bracket_debug_label_thickness_mm = 3;
bumper_bracket_debug_label_plate_mm = 16;

// Cross-section clip (bracket coordinates). assembly.scad overrides for preview.
bracket_cross_section = false;
// "x" / "z": offset 0 = centered on footprint; "y": offset 0 = shell_midplane_y_mm.
bracket_cross_axis = "y";
bracket_cross_offset = 0;

// Shell inset rectangular core (between rounded vertical edges): spans QR↔wedge and tread↔pew minus corner offsets.
shell_inset_dim_qr_wedge_mm    = shell_extent_qr_wedge_mm - 2 * corner_r;
shell_inset_dim_tread_pew_mm   = shell_extent_tread_pew_mm - 2 * corner_r;
// Horizontal roof leg along +X from inset QR corner toward wedge rim (hypotenuse ground projection).
shell_wedge_hypotenuse_run_mm  = shell_inset_dim_qr_wedge_mm;

// Tread ghost XY: native frame centers on inset shell core midplanes (origin).
assembly_tread_center_qr_wedge_mm    = 0;
assembly_tread_center_tread_pew_mm   = 0;

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

// Pew-side mounting pad (+X): post-mink exterior datums in functions below.
pew_mount_block_enabled           = true;
pew_mount_block_thickness_x_mm    = 20;
function pew_mount_block_x_center_mm() =
    bracket_face_wedge_x_mm + pew_mount_block_thickness_x_mm / 2;
// −Y face pinned at prism apex (F-side start at lz = shell_height + wedge_leg).
function pew_mount_block_y_lo_mm() =
    bracket_nat_y_mid_mm - shell_height_mm - shell_wedge_leg_mm;
// +Y datum: flange groove floor on E-bevel (shell_tread_pocket_sloped_hull y_bot).
function pew_mount_block_flange_groove_floor_y_mm(z_bracket = pew_mount_block_z_center_mm()) =
    assembly_y_on_e_bevel_plane_bracket_z(z_bracket)
    - tread_core_pocket_depth_z_mm
    - tread_groove_pocket_height_mm
    - epsilon;
// Shorten +Y extent toward F; y_lo unchanged (prism pin).
pew_mount_block_y_hi_shorten_from_groove_floor_mm = 7;
function pew_mount_block_y_hi_mm() =
    pew_mount_block_flange_groove_floor_y_mm()
    - pew_mount_block_y_hi_shorten_from_groove_floor_mm;
function pew_mount_block_y_len_mm() =
    pew_mount_block_y_hi_mm() - pew_mount_block_y_lo_mm();
function pew_mount_block_y_center_mm() =
    (pew_mount_block_y_lo_mm() + pew_mount_block_y_hi_mm()) / 2;
function pew_mount_block_z_len_mm() = shell_extent_tread_pew_mm;
function pew_mount_block_z_center_mm() = 0;

// Assembly pose (assembly.scad): Rx(−bevel) · Rx(90°) · Rz(90°); tread bbox centered on bracket Z (= 0).
function assembly_tread_vertical_auto_mm() = 0;
assembly_tread_z_trim_mm = 0;

function assembly_tread_flange_top_local_z_mm() =
    socket_depth / 2 + core_depth / 2 - 1 + tread_visual_flange_sphere_r;

// Tread local → bracket delta after flange-top anchor (matches assembly.scad rotate chain).
function assembly_tread_local_to_bracket_delta(q_local) =
    let (
        d = q_local - [0, 0, assembly_tread_flange_top_local_z_mm()],
        after_rz = [-d[1], d[0], d[2]],
        after_rx = [after_rz[0], -after_rz[2], after_rz[1]],
        b = tread_face_de_extra_angle_deg,
        cb = cos(b),
        sb = sin(b)
    )
    [
        after_rx[0],
        after_rx[1] * cb + after_rx[2] * sb,
        -after_rx[1] * sb + after_rx[2] * cb,
    ];

function assembly_tread_bracket_z_min_max_at_flange_anchor() =
    let (
        zb = tread_visual_z_bounds_local(),
        xs = [-tread_l / 2, tread_l / 2],
        ys = [-tread_w / 2, tread_w / 2],
        zs = [zb[0], zb[1]],
        z_vals = [
            for (x = xs, y = ys, z = zs)
            assembly_tread_local_to_bracket_delta([x, y, z])[2],
        ]
    )
    [min(z_vals), max(z_vals)];

function assembly_tread_mate_bracket_z_mm() =
    let (z_mm = assembly_tread_bracket_z_min_max_at_flange_anchor())
    -(z_mm[0] + z_mm[1]) / 2 + assembly_tread_z_trim_mm;

// Sloped E-bevel plane (bracket coords); matches bumper-bracket.scad y_on_e_bevel_plane().
function assembly_y_on_e_bevel_plane_bracket_z(z) =
    bracket_nat_y_mid_mm - tread_face_e_bevel_slope_k() * (bracket_face_pew_z_mm - z);

// Flange groove mate: pocket ceiling on E bevel, then inward past the groove hull lip (~flange_depth).
function assembly_tread_flange_groove_hull_inset_mm() = flange_depth;

function assembly_tread_flange_groove_ceiling_y_mm(z_bracket) =
    assembly_y_on_e_bevel_plane_bracket_z(z_bracket)
    - tread_core_pocket_depth_z_mm
    - assembly_tread_flange_groove_hull_inset_mm()
    - epsilon;

// Fine-tune flange ↔ groove ceiling (+ = toward face E / +Y).
assembly_tread_flange_groove_y_trim_mm = -2;

function assembly_tread_mate_bracket_y_mm(z_bracket) =
    assembly_tread_flange_groove_ceiling_y_mm(z_bracket)
    + assembly_tread_flange_groove_y_trim_mm;

function assembly_bracket_flange_groove_top_z_mm() =
    tread_groove_pocket_z0_mm + tread_groove_pocket_height_mm;

function assembly_bracket_groove_ceiling_y_mm() =
    bracket_nat_y_mid_mm - assembly_bracket_flange_groove_top_z_mm();

// Pull-apart in bracket OpenSCAD coords [x, y, z]; [0,0,0] = mated overlap.
exploded_tread_offset_pull = [0, 0, 0];

// Preview-only: shell + wood bores + tread pockets + tread ghost as one rigid unit.
assembly_bumper_group_offset = [0, 0, 0];
assembly_bumper_group_rotate_deg = [45, 0, 0];
// Nudge bumper group in bracket OpenSCAD coords (−Y = toward F/roof, −Z = toward tread slot).
assembly_bumper_group_nudge_x_mm = 0;
assembly_bumper_group_nudge_y_mm = -22;
assembly_bumper_group_nudge_z_mm = -22;

function assembly_bumper_group_offset_vec() = [
    assembly_bumper_group_offset[0] + assembly_bumper_group_nudge_x_mm,
    assembly_bumper_group_offset[1] + assembly_bumper_group_nudge_y_mm,
    assembly_bumper_group_offset[2] + assembly_bumper_group_nudge_z_mm,
];

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

// ── Assembly: pew leg, kneeler stack, kneeler arm (assembly.scad) ─────────────
pew_leg_thickness_in     = 1.5; // 1½" nominal pew leg (face grain for wood screws below)
pew_leg_thickness_mm     = pew_leg_thickness_in * 25.4;
// Assembly pew-leg-visual.scad plan size (square top).
pew_leg_visual_plan_in   = 18;
pew_leg_visual_plan_mm   = pew_leg_visual_plan_in * 25.4;
// Lateral trim past computed pew inner face (+X); 0 = flush to kneeler stack.
assembly_pew_leg_side_gap_mm = 0;
// Fraction of pew-leg span (along bracket Y after Ry(90)) that lies in +Y; rest is −Y.
assembly_pew_leg_positive_y_fraction = 1 / 8;
function assembly_pew_leg_center_y_mm() =
    pew_leg_visual_plan_mm * (assembly_pew_leg_positive_y_fraction - 0.5);

// +X bumper half-width + kneeler plate width − 3/4 tread width (pew on +X).
function assembly_pew_leg_inner_face_x_mm() =
    bracket_face_wedge_x_mm
    + kneeler_bracket_plate_w_mm
    - 3 * tread_w / 4
    + assembly_pew_leg_side_gap_mm;

function assembly_pew_leg_center_x_mm() =
    assembly_pew_leg_inner_face_x_mm() + pew_leg_thickness_mm / 2;

// Kneeler-bracket visual tilt inside assembly_kneeler_pose (degrees, kneeler +X).
assembly_kneeler_bracket_rotate_x_deg = 45;
// Peg support boss top (kneeler local Z); bushing/bumper bases sit here.
assembly_kneeler_support_top_lz_mm = kneeler_bracket_support_h_mm;

function assembly_kneeler_near_peg_x_mm() =
    -kneeler_bracket_plate_l_mm / 2 + kneeler_bracket_peg1_inset_mm;
function assembly_kneeler_far_peg_x_mm() =
    kneeler_bracket_plate_l_mm / 2 - kneeler_bracket_peg2_inset_mm;
function assembly_kneeler_bushing_collar_top_lz_mm() =
    assembly_kneeler_support_top_lz_mm + kneeler_bushing_collar_height_mm;

// kneeler-arm-visual.scad
kneeler_arm_length_mm     = 108;
kneeler_arm_h1_mm         = 34;
kneeler_arm_h2_mm         = 20;
kneeler_arm_thickness_mm  = 18.6;
kneeler_arm_peg_d_mm      = 20;
kneeler_arm_peg_hole_d_mm = 13.8;

function assembly_kneeler_arm_hole_center_lz_mm() =
    assembly_kneeler_bushing_collar_top_lz_mm() + kneeler_arm_thickness_mm / 2;
// Bracket-frame spin about bracket +X at hole (see assembly.scad); Y/Z only, not kneeler-local Ry.
assembly_kneeler_arm_rotate_x_deg = -13.5;

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
