// ─────────────────────────────────────────────────────────────────────────────
// Bumper bracket — shared configuration.
//
// Shell envelope (core + roof wedge + pew mount pad) sized to the kneeler and
// tread envelopes, with #8 wood-screw bores through the roof wedge.
//
// This file is split into two halves:
//   1. PARAMETERS   — every plain `name = value;` declaration, grouped by domain.
//   2. FUNCTIONS    — every `function name() = ...;` derivation, grouped to match.
// OpenSCAD resolves the whole file as one scope, so the split is purely for
// readability; nothing here depends on top-to-bottom ordering.
//
// Bracket coordinate frame (the design frame for bumper-bracket.scad; the body is
// never rotate()-reoriented — bracket_lift_to_bed only translates +Z for export):
//   Origin : footprint center.
//   +X     : QR / kneeler side (−X) toward the wedge and sloped roof (+X rim).
//   +Y     : shell height toward the roof / wedge apex (lower Y = higher up).
//   +Z     : pew engagement (+Z rim); the tread slot opens toward −Z.
// Sizing helpers (lx, ly, lz) use a corner-origin box; bracket_pos() maps those
// into the centered bracket frame.
//
// Face labels (debug preview):
//   A = +X prism / wedge rim     B = −X opposite (narrow) rim
//   C = +Z pew engagement        D = −Z tread slot
//   E = +Y base (sizing lz → 0)  F = −Y roof / wedge apex
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
//  PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════

// ── Global render / build ────────────────────────────────────────────────────
preview             = true;
epsilon             = 0.02;   // manifold fudge for booleans + thin slabs
corner_r            = 1;      // exterior fillet radius (minkowski sphere)
bracket_lift_to_bed = true;   // export: translate so min Z sits on the build plate

// ── Kneeler-bracket reference (keep in sync with kneeler-bracket-visual.scad) ─
kneeler_bracket_plate_thickness_mm   = 5;
kneeler_bracket_plate_l_mm           = 145;
kneeler_bracket_plate_w_mm           = 34;
kneeler_bracket_corner_r_mm          = 5;
kneeler_bracket_peg_od_mm            = 9.4;
kneeler_bracket_peg_top_from_base_mm = 44.5;  // plate bottom (z = 0) → peg top
kneeler_bracket_peg_h_mm             = kneeler_bracket_peg_top_from_base_mm - kneeler_bracket_plate_thickness_mm;
kneeler_bracket_peg1_inset_mm        = 18;
kneeler_bracket_peg2_inset_mm        = 18;     // far peg from +lx rim (bumper peg)
kneeler_bracket_support_h_mm         = 19.5;   // plate bottom → top of peg boss
kneeler_bracket_support_od_mm        = 16;
kneeler_bracket_screw_d_mm           = 5.2;
kneeler_bracket_csink_d_mm           = 10.5;
kneeler_bracket_csink_depth_mm       = 2.5;
kneeler_bracket_screw_x_frac         = [0.28, 0.5, 0.72];
kneeler_bracket_mirror_side          = false;  // false = left, true = right (Y mirror)

// ── Kneeler-bushing reference (keep in sync with kneeler-bushing-visual.scad) ─
kneeler_bushing_total_height_mm  = 24;
kneeler_bushing_id_mm            = 10;
kneeler_bushing_insert_od_mm     = 13.1;
kneeler_bushing_collar_height_mm = 6.3;
kneeler_bushing_collar_od_mm     = 16.2;

// ── Kneeler-bumper reference (keep in sync with kneeler-bumper-visual.scad) ───
kneeler_bumper_height_mm    = 23.8;
kneeler_bumper_od_mm        = 17.5;
kneeler_bumper_peg_od_mm    = 9.7;
kneeler_bumper_tightness_mm = 0.3;
kneeler_bumper_id_mm        = kneeler_bumper_peg_od_mm - kneeler_bumper_tightness_mm;

// ── Kneeler-arm reference (keep in sync with kneeler-arm-visual.scad) ─────────
kneeler_arm_length_mm     = 108;
kneeler_arm_h1_mm         = 34;
kneeler_arm_h2_mm         = 20;
kneeler_arm_thickness_mm  = 18.6;
kneeler_arm_peg_d_mm      = 20;
kneeler_arm_peg_hole_d_mm = 13.8;

// ── Tread / sole reference (keep in sync with prayer-sole v3 tread.scad) ──────
tread_tightness            = 0.1;   // tolerance from tread.scad
sole_plate_l               = 53;
sole_plate_w               = 18.5;
groove_overhang            = 2;
socket_depth               = 5;
core_protrusion            = 2;
flange_clearance           = 0.2;
tread_flange_envelope_z_mm = 3.4;   // minkowski flange height (cube + 2×sphere)
tread_visual_flange_sphere_r = 1.0;
flange_depth               = tread_flange_envelope_z_mm - 2 * tread_visual_flange_sphere_r;  // 1.4 mm cube → 3.4 mm envelope

// Derived tread geometry.
tread_l            = sole_plate_l + tread_tightness;
tread_w            = sole_plate_w + tread_tightness;
core_depth         = socket_depth + core_protrusion;
tread_rib_radius_mm = socket_depth / 2;   // rib cylinder radius (was "radius")
// Conservative tread vertical span (core + ribs + flange minkowski).
tread_z_span_mm    = (socket_depth / 2 + core_depth / 2) - (-core_protrusion / 2 - tread_rib_radius_mm)
                     + flange_depth + 4;

// Tread slide-in groove footprint (tread.scad).
groove_l = sole_plate_l + (groove_overhang * 2) - flange_clearance;
groove_w = sole_plate_w + (groove_overhang * 2) - flange_clearance;

// ── Exterior sizing rules ────────────────────────────────────────────────────
side_margin_each_mm    = 0.5 * 25.4;   // ½" added on each side of the tread Z span
width_extra_half_tread = true;         // add ½ tread width along the QR↔wedge extent
// Pew engagement depth along +Y (shell_face_pew at y = shell_extent_tread_pew_mm).

// ── Shell + wedge: overall extents ───────────────────────────────────────────
// Right-triangle roof prism on the roof–rim section: 90° at the inset corner,
// 60° at the roof, 30° at the rim. Apex rises toward the +X rim and lower Y.
shell_wedge_prism_roof_angle_deg = 60;

shell_extent_qr_wedge_mm  =
    kneeler_bracket_plate_thickness_mm + kneeler_bumper_height_mm + (width_extra_half_tread ? tread_w / 2 : 0);
shell_extent_tread_pew_mm = 3 * 25.4;   // 3" pew engagement along +Y
shell_height_mm           = tread_z_span_mm + 2 * side_margin_each_mm;

// Wedge run / leg (leg comes from the roof angle, not a fixed height).
shell_inset_dim_qr_wedge_mm   = shell_extent_qr_wedge_mm - 2 * corner_r;
shell_inset_dim_tread_pew_mm  = shell_extent_tread_pew_mm - 2 * corner_r;
shell_wedge_hypotenuse_run_mm = shell_inset_dim_qr_wedge_mm;
shell_wedge_leg_mm            = shell_wedge_hypotenuse_run_mm * tan(shell_wedge_prism_roof_angle_deg);

// ── Bracket frame: mid planes + face positions ───────────────────────────────
shell_midplane_lz_mm = shell_height_mm / 2;   // sizing axis mid (lz)
bracket_nat_y_mid_mm = (shell_height_mm + shell_wedge_leg_mm + corner_r) / 2;
shell_midplane_y_mm  = bracket_nat_y_mid_mm - shell_midplane_lz_mm;

bracket_face_tread_slot_z_mm = -shell_extent_tread_pew_mm / 2;  // D (−Z mouth)
bracket_face_pew_z_mm        =  shell_extent_tread_pew_mm / 2;  // C (+Z pew)
bracket_face_wedge_x_mm      =  shell_extent_qr_wedge_mm / 2;   // A (+X rim)

// ── Shell envelope anchors (pre-minkowski union: core + roof wedge + pew pad) ─
shell_envelope_inset_lx_mm = corner_r;
shell_envelope_inset_ly_mm = corner_r;
shell_envelope_roof_lz_mm  = shell_height_mm;
shell_envelope_apex_lz_mm  = shell_height_mm + shell_wedge_leg_mm;
shell_envelope_core_lx_mm  = shell_inset_dim_qr_wedge_mm;
shell_envelope_core_ly_mm  = shell_inset_dim_tread_pew_mm;
shell_envelope_core_lz_mm  = shell_height_mm - corner_r;

// ── E-bevel (side D, −Z tread slot) ──────────────────────────────────────────
// 9.8° bevel: C∩E flush, D∩E inset; D∩F stays 90°.
tread_face_de_extra_angle_deg = 9.8;
// Y inset at D∩E for the nominal C↔D span (≈12.8 mm at the default depth).
tread_face_d_e_side_y_narrow_mm = tan(tread_face_de_extra_angle_deg) * shell_extent_tread_pew_mm;

// ── Wood screws (#8; major Ø ~0.164"); through the roof-wedge hypotenuse ──────
wood_screw_holes_enabled    = true;
wood_screw_hole_y_fractions = [1/6, 1/2, 5/6];  // spacing along tread↔pew (bracket +Z)
wood_screw_gauge            = 8;
wood_shank_nominal_mm       = 4.17;
wood_shank_clr              = wood_shank_nominal_mm + 0.92;  // sliding fit + angled drive
wood_head_diameter          = 10;    // Ø for flat or trim-washer head flare
wood_countersink_depth_mm   = 4.5;   // model depth toward wood for head recess
screw_chamfer_lip_mm        = 0.65;  // Ø flare added for printed chamfer clearance
// Thread-depth target: ~1" into solid wood, comfortably inside a 1½" leg.
tip_breakout_margin_mm      = 25.4 * 7 / 32;  // ~7/16" shy of the far face / split line
// NOTE: the derived bore length (wood_bored_axial_mm) + screw-length guidance live
// in the "Derived wood-screw lengths" block below, since they need the pew-leg and
// mount-block thicknesses defined first (OpenSCAD evaluates these in file order).

// ── Tread pockets — flange groove ────────────────────────────────────────────
tread_groove_shell_pocket_enabled = true;
// Treads stacked flange-to-flange in one slot: 1 → single 3.4 mm flange slot;
// 2 → 6.8 mm slot for two back-to-back treads. The ceiling stays pinned under the
// core pocket; the extra depth grows toward F.
flange_slot_tread_count                = 2;
tread_groove_pocket_break_tread_face_mm = corner_r + 1;  // open the mouth past exterior rounding
tread_groove_pocket_z_clear_mm          = 0;             // extra on (count × flange envelope)
// Inward +Y depth from the nominal tread face (y ≈ 0): (shell depth + groove_l)/2.
tread_groove_pocket_inward_y_mm =
    shell_extent_tread_pew_mm - (shell_extent_tread_pew_mm - groove_l) / 2;
// Stack 2× flange_depth above the shell core floor (z = corner_r) so the corner
// minkowski does not eat the flange-pocket floor margin.
tread_groove_pocket_z_above_shell_core_floor_mm = 2 * flange_depth;
tread_groove_pocket_z0_mm     = corner_r + tread_groove_pocket_z_above_shell_core_floor_mm;
tread_groove_pocket_height_mm = flange_slot_tread_count * tread_flange_envelope_z_mm + tread_groove_pocket_z_clear_mm;

// ── Tread pockets — rigid core (outer + buried inner tread) ──────────────────
tread_core_shell_pocket_enabled = true;
// Canonical +Z: ceiling = flange-pocket floor (tread_groove_pocket_z0_mm). Pockets
// subtract AFTER the minkowski, so rounding adds solid in z ∈ [0, corner_r] under
// the inset cube; the floor datum is the tangent bottom (z = 0) with −4ε breakout.
tread_core_pocket_floor_z_mm   = -4 * epsilon;
tread_core_pocket_ceiling_z_mm = tread_groove_pocket_z0_mm;
tread_core_pocket_depth_z_mm   = tread_core_pocket_ceiling_z_mm - tread_core_pocket_floor_z_mm;
// Same +Y pairing as the flange pocket, with tread_l ⇄ groove_l.
tread_core_pocket_inward_y_mm =
    shell_extent_tread_pew_mm - (shell_extent_tread_pew_mm - tread_l) / 2;

// Second core pocket (back-to-back tread): mirrors the first across the flange
// groove on the far (F) side; its ceiling drops past core pocket 1 + the slot.
tread_core_shell_pocket_2_enabled   = true;
tread_core_pocket_2_ceiling_drop_mm = tread_core_pocket_depth_z_mm + tread_groove_pocket_height_mm;
// The inner tread is fully buried, so its pocket must clear the full tread height
// proud of the flange (flange-envelope back face → rib tips ≈ 6.1 mm; use 6.2).
tread_core_pocket_2_depth_z_mm = 6.2;

// ── Pew-side mounting pad (+X) ───────────────────────────────────────────────
// −X face flush with the pre-mink shell/wedge rim; −Y face pinned at the prism apex.
pew_mount_block_enabled        = true;
pew_mount_block_thickness_x_mm = 20;
// Width along +Y. Default ≈ the former flange-derived auto length so prints match.
pew_mount_block_y_len_mm       = 80;

// ── QR-code sticker pocket (face B, −X, opposite the pew / wedge mount side) ──
// Shallow rounded-square ("hull") recess so a 1" printed QR sticker seats flush in
// the flat −X rim. Cuts qr_pocket_depth_mm inward (+X); centered on face B by
// default (offsets shift it along the face).
qr_pocket_enabled     = true;
qr_pocket_size_mm     = 25.4;  // 1" square (overall, including the rounded corners)
qr_pocket_depth_mm    = 0.1;   // sticker recess depth (into +X)
qr_pocket_corner_r_mm = 2;     // hull corner rounding
qr_pocket_y_offset_mm = -3;     // + toward the base (face E, bracket +Y)
qr_pocket_z_offset_mm = 20;     // + toward the pew (face C, bracket +Z)

// ── Tread retention cap (−Z mouth, face D) + single central M3×20 fastener ───
// A separate printed cap closes the tread-slot mouth so the back-to-back treads
// cannot slide out. The cap is a flush plug recessed into a rectangular "cube
// hull" pocket in the gap below the seated treads: its +Z face butts the tread /
// flange −Z ends, its −Y floor stops where the roof wedge starts, and its top is
// clipped by the E-bevel like the rest of the body. One socket-head cap screw
// runs along +Z (centered on the tread, tucked behind the inner tread); its head
// seats in the cap and its shaft threads into an M3 hex nut held in a pocket fed
// by a perpendicular slide-in slot.
tread_cap_enabled = true;

// M3×20 socket-head cap screw + M3 hex nut (keep in sync with prayer-sole config).
cap_bolt_dia           = 3.0;
cap_bolt_clearance     = 0.3;   // shaft hole clearance (sliding fit)
cap_bolt_length        = 20;    // M3×20 shaft length under the head
cap_head_dia           = 6.0;   // socket head Ø
cap_head_clearance     = 0.1;
cap_head_height        = 3.5;   // socket head height
cap_nut_af             = 5.5;   // hex nut across-flats
cap_nut_clearance      = 0.2;
cap_nut_thickness      = 2.4;
cap_nut_pocket_z_extra = 0.5;   // hex seat grows ±Z past the slot → retention shoulder per face
cap_nut_seat_margin_mm = 0.5;   // gap from bolt tip to far face of nut pocket

cap_fit_clearance_mm = 0.15;    // cap shrink on the recess mating faces (slip fit)
cap_tread_gap_mm     = 0.3;     // +Z gap left between the cap face and the tread ends

// Bolt centerline: X centered on the tread; Y a fixed drop behind the inner-tread
// back face (worst case at the mouth, where the bevel sits lowest).
cap_bolt_x_mm                 = 0;
cap_bolt_behind_tread_drop_mm = 6;   // inner-tread back face → bolt centerline (−Y)
inner_tread_depth_below_bevel_mm = tread_core_pocket_2_ceiling_drop_mm + tread_core_pocket_2_depth_z_mm;
// Nut slide-in slot opens into the tread cavity (+Y), never an exterior face.
cap_nut_slot_breakthrough_mm = 2;    // +Y overshoot past the inner-tread back

// ── Assembly preview — bumper group pose ─────────────────────────────────────
// Bracket STL body is never rotated; the preview tilts/moves the bumper unit only.
assembly_bumper_group_offset     = [0, 0, 0];
assembly_bumper_group_rotate_deg = [45, 0, 0];
assembly_bumper_group_nudge_x_mm = 0;
assembly_bumper_group_nudge_y_mm = -38.8;  // −Y = toward F / roof
assembly_bumper_group_nudge_z_mm = -27.8;  // −Z = toward the tread slot

// Tread ghost native frame centers on the inset shell-core midplanes (origin).
assembly_tread_center_qr_wedge_mm  = 0;
assembly_tread_center_tread_pew_mm = 0;
assembly_tread_z_trim_mm               = 0;   // fine-tune tread bbox center on bracket Z
assembly_tread_flange_groove_y_trim_mm = -2;  // fine-tune flange ↔ groove ceiling (+ = toward E)

// Exploded pull-apart vectors (bracket coords); [0,0,0] = mated.
exploded_tread_offset_pull = [0, 0, 0];
exploded_cap_offset_pull   = [0, 0, 0];  // −Z lifts the cap (+ hardware) off the mouth

// ── Assembly preview — kneeler stack + pew leg ───────────────────────────────
pew_leg_thickness_mm   = 1.5 * 25.4;  // 1½" nominal pew leg (face grain for screws)
pew_leg_visual_plan_mm = 18 * 25.4;   // 18" square top (pew-leg-visual.scad)
assembly_pew_leg_side_gap_mm         = 0;     // +X trim past the pew inner face; 0 = flush
assembly_pew_leg_positive_y_fraction = 1 / 8; // fraction of the pew span in +Y

assembly_kneeler_bracket_rotate_x_deg = 45;   // kneeler tilt inside assembly_kneeler_pose
assembly_kneeler_support_top_lz_mm    = kneeler_bracket_support_h_mm;  // peg boss top
assembly_kneeler_arm_rotate_x_deg     = -13.5;  // arm spin about bracket +X at the hole

// ── Derived wood-screw lengths (need pew-leg + mount-block thickness above) ───
// Max solid printed path ⟂ the angled bore (≈ run × leg over the hypotenuse).
plastic_along_bore_mm =
    shell_wedge_hypotenuse_run_mm * shell_wedge_leg_mm
    / sqrt(pow(shell_wedge_hypotenuse_run_mm, 2) + pow(shell_wedge_leg_mm, 2));
// Thread into solid wood; thin legs clamp to a conservative depth.
target_thread_in_wood_mm = let (
    raw = pew_leg_thickness_mm - tip_breakout_margin_mm,
    floors = min(pew_leg_thickness_mm * 0.66, pew_leg_thickness_mm - 11)
) raw > 28 ? raw : floors;
// Informational shank-length advice = plastic path + thread + head recess (+ slack).
recommended_screw_length_mm =
    ceil(plastic_along_bore_mm + target_thread_in_wood_mm + wood_countersink_depth_mm + 2);
// Modeled bore length through wedge (⊥ hypotenuse) + mount block + pew; |u_x| = sin ψ.
wood_bore_sin_axial_x_mm = sin(atan2(shell_wedge_leg_mm, shell_wedge_hypotenuse_run_mm));
wood_bored_axial_mm = ceil(
    plastic_along_bore_mm
    + pew_mount_block_thickness_x_mm / wood_bore_sin_axial_x_mm
    + pew_leg_thickness_mm / wood_bore_sin_axial_x_mm
    + wood_countersink_depth_mm
    + 8);

// ── Cross-section clip (assembly.scad overrides for preview) ─────────────────
bracket_cross_section = false;
bracket_cross_axis    = "y";  // "x"/"z": offset 0 = footprint center; "y": shell_midplane_y_mm
bracket_cross_offset  = 0;

// ── Debug face labels (assembly preview only; not in STL export) ─────────────
bumper_bracket_debug_face_labels_enabled = false;
bumper_bracket_debug_label_font          = "Liberation Sans:style=Bold";
bumper_bracket_debug_label_size_mm       = 12;
bumper_bracket_debug_label_offset_mm     = 8;
bumper_bracket_debug_label_thickness_mm  = 3;
bumper_bracket_debug_label_plate_mm      = 16;


// ═══════════════════════════════════════════════════════════════════════════
//  FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// ── Bracket frame mapping ────────────────────────────────────────────────────
// Corner-origin sizing (lx, ly, lz) → centered bracket OpenSCAD coordinates.
function bracket_pos(lx, ly, lz) = [
    lx - shell_extent_qr_wedge_mm / 2,
    bracket_nat_y_mid_mm - lz,
    ly - shell_extent_tread_pew_mm / 2,
];

// ── Shell envelope anchors (derived centers / rims) ──────────────────────────
function shell_envelope_core_center_lxlz() = [
    shell_envelope_inset_lx_mm + shell_envelope_core_lx_mm / 2,
    shell_envelope_inset_ly_mm + shell_envelope_core_ly_mm / 2,
    corner_r + shell_envelope_core_lz_mm / 2,
];
function shell_envelope_core_ly_center_mm() =
    shell_envelope_inset_ly_mm + shell_envelope_core_ly_mm / 2;
function shell_envelope_core_z_center_mm() =
    bracket_pos(0, shell_envelope_core_ly_center_mm(), 0)[2];
function shell_envelope_wedge_xr_lx_mm() =
    shell_envelope_inset_lx_mm + shell_inset_dim_qr_wedge_mm;
function shell_envelope_wedge_rim_x_mm() =
    bracket_pos(shell_envelope_wedge_xr_lx_mm(), 0, 0)[0];
function shell_envelope_prism_apex_y_mm() =
    bracket_nat_y_mid_mm - shell_envelope_apex_lz_mm;

// ── E-bevel plane (side D) ───────────────────────────────────────────────────
function tread_face_e_bevel_slope_k() = tan(tread_face_de_extra_angle_deg);
function tread_face_de_cut_slope_deg() = tread_face_de_extra_angle_deg;

// ── Wood-screw bore geometry (on the roof-wedge hypotenuse, face 0–2–1) ──────
// lx from the inset corner → rim; lz = roof + rise (sizing lx–lz plane).
function wood_screw_hole_lx_mm() =
    corner_r + shell_wedge_hypotenuse_run_mm / 2;
function wood_screw_hole_ly_mm(y_frac) =
    corner_r + shell_inset_dim_tread_pew_mm * y_frac;
function wood_screw_hole_lz_mm() =
    shell_height_mm
    + shell_wedge_leg_mm
      * (wood_screw_hole_lx_mm() - corner_r)
      / shell_wedge_hypotenuse_run_mm;

// Hypotenuse outward normal (bracket X–Y); pairs with rotate([-90,0,0]) in
// wood_mount_hole(). Offset by corner_r to the minkowski skin (head recess at z=0).
function wood_screw_hyp_outward_bracket_unit() =
    let (
        run = shell_wedge_hypotenuse_run_mm,
        leg = shell_wedge_leg_mm,
        hyp = sqrt(run * run + leg * leg)
    )
    [leg / hyp, run / hyp, 0];

function wood_screw_hole_exterior_bracket_pos(y_frac) =
    bracket_pos(
        wood_screw_hole_lx_mm(),
        wood_screw_hole_ly_mm(y_frac),
        wood_screw_hole_lz_mm()
    ) + wood_screw_hyp_outward_bracket_unit() * corner_r;

// ── Tread ghost local Z bounds (conservative bbox vs ribs/core/flange) ───────
function tread_visual_z_bounds_local() = let (
    z_core_lo = socket_depth / 2 - core_depth / 2,
    z_core_hi = socket_depth / 2 + core_depth / 2,
    z_rib_lo = -core_protrusion / 2 - tread_rib_radius_mm,
    z_rib_hi = -core_protrusion / 2 + tread_rib_radius_mm,
    z_fl_c = socket_depth / 2 + core_depth / 2 - flange_depth / 2 - 1,
    z_fl_lo = z_fl_c - flange_depth / 2 - 2,
    z_fl_hi = z_fl_c + flange_depth / 2 + 2
) [
    min(z_core_lo, z_rib_lo, z_fl_lo),
    max(z_core_hi, z_rib_hi, z_fl_hi)
];
function tread_visual_z_span_mm() = let (b = tread_visual_z_bounds_local()) b[1] - b[0];

// ── Pew-side mounting pad (derived positions) ────────────────────────────────
function pew_mount_block_x_center_mm() =
    shell_envelope_wedge_rim_x_mm() + pew_mount_block_thickness_x_mm / 2;
function pew_mount_block_y_lo_mm()    = shell_envelope_prism_apex_y_mm();  // pinned at apex (F side)
function pew_mount_block_y_hi_mm()    = pew_mount_block_y_lo_mm() + pew_mount_block_y_len_mm;
function pew_mount_block_y_center_mm() = pew_mount_block_y_lo_mm() + pew_mount_block_y_len_mm / 2;
function pew_mount_block_z_len_mm()   = shell_envelope_core_ly_mm;
function pew_mount_block_z_center_mm() = shell_envelope_core_z_center_mm();

// ── Tread retention cap (derived positions) ──────────────────────────────────
// Seated tread −Z end (bracket frame): assembly.scad centers the tread bbox on
// z = 0, so its −Z extent is −½·span (+ any z trim). The cap face sits just shy.
function tread_seated_bracket_z_min_mm() =
    let (z = assembly_tread_bracket_z_min_max_at_flange_anchor())
    -(z[1] - z[0]) / 2 + assembly_tread_z_trim_mm;

// Recess ("cube hull") extents — bracket frame.
function tread_cap_recess_z_lo_mm()   = bracket_face_tread_slot_z_mm;                       // mouth / flush face
function tread_cap_recess_z_hi_mm()   = tread_seated_bracket_z_min_mm() - cap_tread_gap_mm; // butts the treads
function tread_cap_recess_y_lo_mm()   = bracket_nat_y_mid_mm - shell_height_mm;             // wedge start (core/wedge seam)
function tread_cap_recess_y_hi_mm()   = bracket_nat_y_mid_mm + corner_r + 2;                // above E; bevel clips the real top
function tread_cap_recess_x_half_mm() = shell_extent_qr_wedge_mm / 2;                       // core half-width (excludes +X mount block)

// Bolt centerline Y: drop below the inner-tread back face at the mouth bevel.
function cap_bolt_y_mm() =
    assembly_y_on_e_bevel_plane_bracket_z(bracket_face_tread_slot_z_mm)
    - inner_tread_depth_below_bevel_mm
    - cap_bolt_behind_tread_drop_mm;

// Z stations along the bolt axis (bracket frame; +Z = into the part). The cap's
// outer face is flush with the mouth, so the head seats from the mouth plane.
function tread_cap_mouth_z_mm()   = bracket_face_tread_slot_z_mm;
function tread_cap_outer_z_mm()   = bracket_face_tread_slot_z_mm;
function cap_bolt_head_end_z_mm() = tread_cap_outer_z_mm() + cap_head_height;
function cap_bolt_tip_z_mm()      = cap_bolt_head_end_z_mm() + cap_bolt_length;
function cap_nut_center_z_mm()    = cap_bolt_tip_z_mm() - cap_nut_thickness / 2 - cap_nut_seat_margin_mm;

// Nut capture in Z (prayer-sole collar pattern): the slide-in slot is just tall
// enough to pass the nut (no z_extra), while the hex seat grows cap_nut_pocket_z_extra
// above and below it. The taller seat behind the shorter slot lip keeps the nut
// from flopping/sliding back out once dropped in.
function cap_nut_slot_z_height_mm()   = cap_nut_thickness + cap_nut_clearance;
function cap_nut_pocket_z_height_mm() = cap_nut_slot_z_height_mm() + 2 * cap_nut_pocket_z_extra;

// Nut slot exit Y: +Y into the cavity behind the inner tread (drop-in, slide −Y).
function cap_nut_slot_exit_y_mm() =
    assembly_y_on_e_bevel_plane_bracket_z(cap_nut_center_z_mm())
    - inner_tread_depth_below_bevel_mm
    + cap_nut_slot_breakthrough_mm;

// ── Assembly: bumper group pose ──────────────────────────────────────────────
function assembly_bumper_group_offset_vec() = [
    assembly_bumper_group_offset[0] + assembly_bumper_group_nudge_x_mm,
    assembly_bumper_group_offset[1] + assembly_bumper_group_nudge_y_mm,
    assembly_bumper_group_offset[2] + assembly_bumper_group_nudge_z_mm,
];

// ── Assembly: tread mate (Rx(−bevel)·Rx(90°)·Rz(90°); bbox centered on Z=0) ──
function assembly_tread_vertical_auto_mm() = 0;
function assembly_tread_flange_top_local_z_mm() =
    socket_depth / 2 + core_depth / 2 - 1 + tread_visual_flange_sphere_r;

// Tread local → bracket delta after the flange-top anchor (matches the rotate chain).
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

// Flange-groove mate: pocket ceiling on the E bevel, then inward past the hull lip.
function assembly_tread_flange_groove_hull_inset_mm() = flange_depth;
function assembly_tread_flange_groove_ceiling_y_mm(z_bracket) =
    assembly_y_on_e_bevel_plane_bracket_z(z_bracket)
    - tread_core_pocket_depth_z_mm
    - assembly_tread_flange_groove_hull_inset_mm()
    - epsilon;
function assembly_tread_mate_bracket_y_mm(z_bracket) =
    assembly_tread_flange_groove_ceiling_y_mm(z_bracket)
    + assembly_tread_flange_groove_y_trim_mm;

function assembly_bracket_flange_groove_top_z_mm() =
    tread_groove_pocket_z0_mm + tread_groove_pocket_height_mm;
function assembly_bracket_groove_ceiling_y_mm() =
    bracket_nat_y_mid_mm - assembly_bracket_flange_groove_top_z_mm();

// ── Assembly: kneeler stack + pew leg (derived positions) ────────────────────
function assembly_pew_leg_center_y_mm() =
    pew_leg_visual_plan_mm * (assembly_pew_leg_positive_y_fraction - 0.5);
// +X bumper half-width + kneeler plate width − ¾ tread width (pew on +X).
function assembly_pew_leg_inner_face_x_mm() =
    bracket_face_wedge_x_mm
    + kneeler_bracket_plate_w_mm
    - 3 * tread_w / 4
    + assembly_pew_leg_side_gap_mm;
function assembly_pew_leg_center_x_mm() =
    assembly_pew_leg_inner_face_x_mm() + pew_leg_thickness_mm / 2;

function assembly_kneeler_near_peg_x_mm() =
    -kneeler_bracket_plate_l_mm / 2 + kneeler_bracket_peg1_inset_mm;
function assembly_kneeler_far_peg_x_mm() =
    kneeler_bracket_plate_l_mm / 2 - kneeler_bracket_peg2_inset_mm;
function assembly_kneeler_bushing_collar_top_lz_mm() =
    assembly_kneeler_support_top_lz_mm + kneeler_bushing_collar_height_mm;
function assembly_kneeler_arm_hole_center_lz_mm() =
    assembly_kneeler_bushing_collar_top_lz_mm() + kneeler_arm_thickness_mm / 2;


/*
  Wood-screw length advice (manual install):
  • Path along the bore ≈ plastic_along_bore_mm (run·leg / sqrt(run²+leg²)).
  • For a 1½" (≈38 mm) leg: target ~⅞"–1¼" (22–32 mm) of thread in SOLID stock so
    the tip does not exit — use recommended_screw_length_mm as a guide.
  • Typical pick: #8 × 2¼" (57 mm) or #8 × 2" (51 mm) trim / cabinet / GRK screws.
  • Pilot: softwood ~7/64" (≈2.75 mm); hardwood ~9/64" (≈3.57 mm).

  Rough filament check (slicer is authoritative):
  • Outer box ≈ shell_extent_qr_wedge_mm × shell_extent_tread_pew_mm × shell_height_mm.
  • Roof wedge ≈ ½ × shell_extent_qr_wedge_mm × shell_wedge_leg_mm × shell_extent_tread_pew_mm.
*/
