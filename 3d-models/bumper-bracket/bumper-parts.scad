include <config.scad>

// Shared modules: bumper bracket body + cap (single M3). See bumper-bracket.scad / bumper-cap.scad.

$fn = preview ? 32 : 64;

// Triangular prism + overlap slab. Apex +X matches shell inset rim (**xr = width_outer − corner_r**) so wedge
// max **x** matches shell core (flush); outer +X becomes a vertical face at **x = xr** joint with cube right wall.
module mount_wedge_primitive(overlap_below = corner_r) {
    bx = corner_r;
    by = corner_r;
    Dc = mount_wedge_depth_core;
    xr = bx + mount_wedge_width_core; // width_outer − corner_r — same max **x** as shell inset cube top
    Zr = mount_leg_mm;

    translate([bx, by, -overlap_below])
        cube([mount_wedge_width_core, Dc, overlap_below]);

    polyhedron(
        points = [
            [bx, by, 0],       // 0 lf roof
            [xr, by, 0],       // 1 rf roof / +X rim
            [xr, by, Zr],      // 2 apex −Y cap
            [bx, by + Dc, 0],  // 3 lf roof (+Y)
            [xr, by + Dc, 0],  // 4 rf roof (+Y)
            [xr, by + Dc, Zr], // 5 apex +Y cap
        ],
        faces = [
            [0, 1, 4, 3],       // footprint on roof plane (inside union with cube top)
            [1, 2, 5, 4],       // outer +X vertical façade at **x = xr**
            [0, 3, 5, 2],       // hypotenuse (single sloped face)
            [0, 2, 1],          // cap triangle y = by
            [3, 4, 5],          // cap triangle y = by + Dc
        ],
        convexity = 4
    );
}

module main_block_shell() {
    difference() {
        minkowski() {
            union() {
                translate([corner_r, corner_r, corner_r])
                    cube([
                        width_outer - 2 * corner_r,
                        depth_mm - 2 * corner_r,
                        // Extend to roof z = height_outer (not H−2·corner_r) so top matches prism slab plane;
                        // otherwise core ended at z = H−corner_r vs slab at z = H ⇒ exterior seam ring after minkowski.
                        height_outer - corner_r,
                    ]);
                translate([0, 0, height_outer])
                    mount_wedge_primitive();
            }
            sphere(r=corner_r, $fn=preview ? 16 : 24);
        }
        translate([wall, wall, wall])
            cube([width_outer - 2 * wall, depth_mm - 2 * wall, height_outer - 2 * wall + 1]);
    }
}

// Tread cavity: groove_l / tread_l (−− long sole) parallel to +Y (3″ pew depth).
// Sole width (groove_w / tread_w) across +X toward peg stack — slide flange along ±Y via low‑X opening.
module tread_clearance_cutout() {
    cx = width_outer / 2;
    cy = depth_mm / 2;
    floor_z = wall + 0.5;
    z_socket = floor_z + bottom_socket_h / 2;
    groove_z = floor_z + bottom_socket_h - groove_h / 2 - 1;

    translate([cx, cy, z_socket])
        cube([tread_w + 0.5, tread_l + 0.5, bottom_socket_h + 0.5], center=true);

    translate([cx, cy, z_socket + bottom_socket_h / 2 + core_depth / 2])
        cube([tread_w + 0.5, tread_l + 0.5, core_depth + 0.5], center=true);

    translate([cx, cy, groove_z])
        minkowski() {
            cube([groove_w - 2 + 0.5, groove_l - 2 + 0.5, groove_h], center=true);
            sphere(r=1.0, $fn=preview ? 12 : 24);
        }

    translate([cx, cy, floor_z + bottom_socket_h * 0.35])
        cube([tread_w + 8, tread_l + 4, radius * 2 + 4], center=true);
}

module slide_entrance_cut() {
    translate([wall - 2, depth_mm / 2, wall + bottom_socket_h * 0.5])
        cube([wall + 8, groove_l + 6, groove_h + core_depth + bottom_socket_h], center=true);
}

// Z on sloped prism face (XZ hypotenuse) at given X along roof run (corner_r → width_outer − corner_r).
function hyp_z_at_x(x) =
    mount_leg_mm * (x - corner_r) / mount_wedge_hyp_run_x;

// Screw bores ⊥ hypotenuse: row at mid **X** on hypotenuse, **Y** from hole_y_frac; chamfer on exterior (−half of bore axis).
module wood_mount_hole(y_frac) {
    xw = corner_r + mount_wedge_hyp_run_x / 2;
    zw = height_outer + hyp_z_at_x(xw);
    y_w = corner_r + mount_wedge_depth_core * y_frac;
    psi_deg = atan2(mount_leg_mm, mount_wedge_hyp_run_x);
    ry_deg = psi_deg + 90;
    half = wood_bored_axial_mm / 2;
    $fn = preview ? 28 : 64;

    translate([xw, y_w, zw])
        rotate([0, ry_deg, 0])
            union() {
                cylinder(h = wood_bored_axial_mm, d = wood_shank_clr, center = true);
                translate([0, 0, -half - wood_countersink_depth_mm - epsilon])
                    cylinder(
                        h = wood_countersink_depth_mm + epsilon * 3,
                        r1 = wood_head_diameter / 2 + screw_chamfer_lip_mm,
                        r2 = wood_shank_clr / 2 + epsilon,
                        center = false
                    );
            }
}

module wood_screw_pattern() {
    for (yf = hole_y_frac)
        wood_mount_hole(yf);
}

// 180° Rx on the tread cavity + slide slot only, pivot = geometric center of those voids
// (same [cx, cy] as pocket; Z = mid of socket/groove/slide stack) so the bracket shell does not “tilt”.
module tread_cutouts_rx180() {
    cx = width_outer / 2;
    cy = depth_mm / 2;
    floor_z = wall + 0.5;
    z_socket = floor_z + bottom_socket_h / 2;
    groove_z = floor_z + bottom_socket_h - groove_h / 2 - 1;
    rib_cz = floor_z + bottom_socket_h * 0.35;
    rib_half = (radius * 2 + 4) / 2;
    z_lo = min(
        z_socket - bottom_socket_h / 2 - 0.25,
        groove_z - groove_h / 2 - 2,
        rib_cz - rib_half
    );
    z_hi = max(
        z_socket + bottom_socket_h / 2 + core_depth + 0.25,
        groove_z + groove_h / 2 + 2,
        rib_cz + rib_half
    );
    slide_cz = wall + bottom_socket_h * 0.5;
    slide_half = (groove_h + core_depth + bottom_socket_h) / 2;
    pz = (min(z_lo, slide_cz - slide_half) + max(z_hi, slide_cz + slide_half)) / 2;

    translate([cx, cy, pz])
        rotate([180, 0, 0])
            translate([-cx, -cy, -pz]) {
                tread_clearance_cutout();
                slide_entrance_cut();
            }
}

module bumper_bracket() {
    difference() {
        main_block_shell();
        tread_cutouts_rx180();
        wood_screw_pattern();
    }
}

module bumper_cap() {
    difference() {
        union() {
            translate([width_outer - cap_x_ext, 0, 0])
                cube([cap_x_ext, depth_mm, height_outer]);
            translate([width_outer - cap_x_ext - cap_wall, wall, wall])
                cube([cap_wall + 1, depth_mm - 2 * wall, cap_inner_h]);
        }
        translate([width_outer - cap_wall - 1, wall - 1, wall + bolt_head_height])
            rotate([0, 90, 0])
                cylinder(h=cap_x_ext + cap_wall + 4, d=bolt_diameter, center=false);
        translate([width_outer - wall - 0.5, wall + (depth_mm - 2 * wall) / 2, wall + bolt_head_height])
            rotate([0, 90, 0])
                rotate([0, 0, 30])
                    cylinder(h=nut_thickness + 2, r=(nut_af / 2) / cos(30), $fn=6, center=true);
        translate([width_outer - cap_wall - bolt_head_height, wall + (depth_mm - 2 * wall) / 2, wall + bolt_head_height])
            rotate([0, 90, 0])
                cylinder(h=bolt_head_height + 1, d=bolt_head_diameter, center=false);
    }
}

module bumper_assembly() {
    color([0.75, 0.72, 0.68]) bumper_bracket();
    color([0.55, 0.58, 0.62], 0.85) bumper_cap();
}
