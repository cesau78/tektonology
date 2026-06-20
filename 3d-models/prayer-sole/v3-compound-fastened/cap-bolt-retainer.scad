// --- TEKTONOLOGY BOLT RETAINER ---
// Push-on anti-loss clip for M3×0.5 socket-head cap screws (Prayer Sole cap).
// Rigid outer ring seats against the cap wall; four flex prongs extend inward
// from the ring bore and grip the shank (outlet-cover screw-retainer style).
//
// Print flat (XY), 0.2 mm layers; PETG or nylon recommended for flex/fatigue.

// --- M3 thread envelope ---
thread_major = 3.0;   // M3 nominal major diameter (mm)
thread_pitch = 0.5;

// --- Outer seating ring ---
ring_od      = 5.5;   // seats on cap boss / wall (cf. commercial panel retainer ≈ 4.3)
ring_id      = 4.4;   // inner bore — prongs root on this wall
ring_height  = 0.75;  // rigid seat flange (Z)

// --- Flex prongs (fused to ring inner wall) ---
prong_height = 0.5;  // thin grip only — cf. stamped panel retainers ≈ 0.4 mm
grip_dia     = 2.65;  // engaged ID — slightly under major Ø for thread bite
entry_dia    = 3.15;  // lead-in at prong tips (screw spreads prongs on install)
prong_count  = 4;
slot_width   = 0.85;  // gap between prongs (mm) — narrower for four fingers
// Prongs at cap-facing / seat side of ring
prong_z      = -(ring_height / 2) + (prong_height / 2);

// --- Optional batch layout for printing ---
print_qty = 1;        // set >1 to lay out a small plate
print_pitch = ring_od + 1.5;

// --- Mesh quality ---
preview = false;
$fn = preview ? 32 : 96;

// =====================================================================
// RETAINER BODY
// =====================================================================

module outer_ring() {
  difference() {
    cylinder(d=ring_od, h=ring_height, center=true);
    cylinder(d=ring_id, h=ring_height + 0.02, center=true);
  }
}

// Four prongs cut from a disk fused to the ring OD/ID wall at prong_z.
module flex_prongs() {
  r_o = ring_od / 2;
  entry_r = entry_dia / 2;

  translate([0, 0, prong_z])
  difference() {
    // One piece with outer ring wall — roots on ring_id bore
    cylinder(d=ring_od, h=prong_height, center=true);

    // Lead-in bore at prong tips
    cylinder(d=entry_dia, h=prong_height + 0.02, center=true);

    // Radial slots → four prongs attached at the outer ring
    for (i = [0 : prong_count - 1]) {
      rotate([0, 0, i * (360 / prong_count)])
        translate([(entry_r + r_o) / 2, 0, 0])
          cube([r_o - entry_r + 0.2, slot_width, prong_height + 0.02], center=true);
    }
  }
}

module bolt_retainer() {
  union() {
    outer_ring();
    flex_prongs();
  }
}

module bolt_retainer_plate(qty = print_qty) {
  if (qty <= 1) {
    bolt_retainer();
  } else {
    for (i = [0 : qty - 1])
      translate([i * print_pitch, 0, 0])
        bolt_retainer();
  }
}

// =====================================================================
// DEBUG — M3 shank for fit check (comment out for STL export)
// =====================================================================

module debug_m3_shank(len = 12) {
  color("silver", 0.55)
    union() {
      translate([0, 0, ring_height / 2 + 0.01])
        cylinder(d=thread_major, h=len);
      translate([0, 0, ring_height / 2 + len + 1.75])
        cylinder(d=5.5, h=3.5, $fn=6); // rough socket-head stand-in
    }
}

// =====================================================================
// RENDERING
// =====================================================================

bolt_retainer_plate();

// Uncomment to preview retainer seated on shank:
// %translate([0, 0, ring_height / 2]) debug_m3_shank();
