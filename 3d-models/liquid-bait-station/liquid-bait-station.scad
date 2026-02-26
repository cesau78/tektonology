// Liquid Bait Station OpenSCAD Model

//Performance Settings
preview = false; //set preview=true for faster rendering with lower detail, or false for full detail.
crosssection_view = false; // Set to true to cut the model along a plane and show only one side
crosssection_axis = "z"; // axis: 'x', 'y', or 'z'
crosssection_pos = 3; // position (mm) along the chosen axis where the cut occurs (default 0 = origin)

$fn = preview ?  32 : 64;

wall = 2;
torus_max_in = 3.0; // Max torus diameter (inches)

core_dia = 32;
base_height = 35;
reservoir_id = 25; //24 = standard plastic bottle od
tube_od = 10;
tube_id = 6;


port_height = wall + (tube_od / 2); // arm center at tower face — bottom of arm flush with reservoir floor
clearance = 0.2;           // general fit clearance for mating cuts (mm)
inner_extension = 5;       // how far tube arms extend into the tower (mm)

// PCO 1881 Thread Profile (28mm CSD finish)
// Ref: ISBT drawing 3784253-21, 650° travel, 2.7mm pitch
thread_pitch       = 2.7;                 // mm per revolution (PCO 1881 standard)
thread_depth       = 1.15;                // Radial depth of thread groove (mm into wall)
thread_turns       = 1.81;                // 650° / 360° ≈ 1.81 turns
thread_groove_w    = thread_pitch * 0.6;  // Axial groove width (~1.62mm, leaves 40% land)
thread_step        = 10;                  // Degrees per loop step
thread_offset = 0.2; // mm to shift thread up for proper overlap with lead-in cut

// O-Ring Groove (AS568-118 style radial seal)
oring_cs         = 2.62;           // O-ring cross-section diameter (mm)
oring_groove_w   = oring_cs * 1.1; // groove axial width (~2.88mm)
// Position: below thread start with 1mm safety gap
oring_z = base_height - (thread_turns * thread_pitch) - oring_groove_w - 1;

// Geometry Calculations
// Number of arms and derived angular offsets
arms = 3; // number of radial arms/ports
arm_step = 360 / arms;
strut_offset = arm_step / 2; // halfway between arms
entrance_offset = strut_offset - 10; // entrance offset (e.g., 15 deg for 6 arms)
lower_backstop_offset = entrance_offset + 6; // between entrance and nearest strut
upper_backstop_offset = 6; // small tuned offset for backstops

// Upper torus center height — pinned so torus stays in place when reservoir height changes
upper_z = 37;

// Compute arm_length so that the slanted arm reaches the torus center at upper_z
torus_dia = torus_max_in * 25.4; // convert inches to mm (4 in = 101.6 mm)
// horizontal distance from tower outer to torus centerline
horizontal_run = (torus_dia / 2) - (core_dia / 2) + (tube_od / 2);
// vertical distance from the port center up to the torus centerline
vertical_run = upper_z - port_height;

// compute tilt angle so the arm points from the port up to the torus centerline
tilt_angle = atan(vertical_run / horizontal_run);
// compute arm length from horizontal run and tilt angle: arm_length * cos(tilt_angle) = horizontal_run
// guard against near-90deg tilt where cos is ~0
arm_length = (horizontal_run / cos(tilt_angle));

// radial tip radius (horizontal projection) - should equal torus center radius
tip_r = (core_dia / 2) + (arm_length * cos(tilt_angle));

lower_z = (tube_od / 2) + 3; // raised 3mm so torus clears build plate

// Assembly: two-stage CSG to protect backstop plugs from torus cutouts.
// Stage 1: union all solids, subtract all cutouts (torus rotate_extrude hollows the ring).
// Stage 2: union backstop plugs (solid spheres that block flow), then re-cut
//          entrance holes, strut channels, and arm channels through them.
module liquid_bait_station() {
    union() {
        difference() {
            union() {
                central_tower_solid();
                tube_arm_solid();
                upper_torus_solid();
                connecting_struts_solid();
                lower_torus_solid();
            }
            central_tower_cutouts();
            tube_arm_cutouts();
            upper_torus_cutouts();
            connecting_struts_cutouts();
            lower_torus_cutouts();
            entrance_holes();
        }
        // Solid plugs added after difference — these block the torus channel
        difference() {
            union() {
                upper_backstop_plugs();
                lower_backstop_plugs();
            }
            // Re-cut channels through the plugs
            entrance_holes();
            connecting_struts_cutouts();
            tube_arm_cutouts();
        }
    }
}


// Shared arm transform: local origin at tower wall, arm exit point.
// Local Z = arm axis (outward+upward), Z=0 = tower surface at port_height.
module arm_base(angle) {
    rotate([0, 0, angle])
    translate([core_dia / 2, 0, port_height])
    rotate([0, 90 - tilt_angle, 0])
    children();
}

module central_tower_solid() {
    render_if_needed() {
        // Outer Tower Body
        cylinder(h=base_height, d=core_dia);
    }
}

module central_tower_cutouts() {
    // Reservoir Well (cut from outer tower, leaving a base to hold the liquid)
    translate([0, 0, wall])
        cylinder(h=(oring_z), d=reservoir_id - oring_groove_w);

    // Bottle Insertion Hole (cut from the tower)
    translate([0, 0, oring_z])
        cylinder(h=(base_height - oring_z) + 1, d=reservoir_id);

    // Thread lead-in: wider bore at top so bottle thread can drop into position.
    translate([0, 0, base_height - 1])
        cylinder(h=2, d=reservoir_id + (thread_depth * 2));

    // O-Ring Groove: semicircular channel cut into the bore wall for radial seal
    // Circle centered on the bore wall so half protrudes into the bore cavity
    translate([0, 0, oring_z + oring_groove_w / 2])
        rotate_extrude()
            translate([reservoir_id / 2, 0])
                circle(d=oring_groove_w);

    // Internal Threads: contiguous right-hand helix via hull() between consecutive steps.
    // hull() fills the tangential gap between steps, eliminating disconnected squares.
    for (i = [0 : thread_step : 360 * thread_turns - thread_step])
        hull() {
            rotate([0, 0, i])
            translate([reservoir_id / 2, 0,
                base_height - thread_offset - (thread_turns * thread_pitch) + ((i / 360) * thread_pitch)])
                cube([thread_depth * 2, 1.0, thread_groove_w], center=true);
            rotate([0, 0, i + thread_step])
            translate([reservoir_id / 2, 0,
                base_height - thread_offset - (thread_turns * thread_pitch) + (((i + thread_step) / 360) * thread_pitch)])
                cube([thread_depth * 2, 1.0, thread_groove_w], center=true);
        }

    // Port Holes for the Arms — shared arm_base ensures alignment with arm channels
    // Cut only through the tower wall (inner_extension deep) rather than the full diameter
    for (a = [0 : arm_step : 359]) {
        arm_base(a)
            translate([0, 0, -inner_extension])
                cylinder(h = inner_extension + 2, d = tube_id);
    }
}

module tube_arm_solid() {
    render_if_needed() {
        for (a = [0 : arm_step : 359]) {
            arm_base(a)
                translate([0, 0, -inner_extension])
                    cylinder(h = arm_length + inner_extension + 1, d = tube_od);
        }
    }
}

module tube_arm_cutouts() {
    render_if_needed() {
        // Internal path (The Straw Hole)
        for (a = [0 : arm_step : 359]) {
            arm_base(a)
                translate([0, 0, -inner_extension - 1])
                    cylinder(h = arm_length + inner_extension + 2, d = tube_id);
        }
    }
}

module upper_torus_solid() {
    render_if_needed() {
        // Solid outer ring
        translate([0, 0, upper_z ])
            rotate_extrude()
                translate([tip_r, 0, 0])
                    circle(d=tube_od);
    }
}

module upper_torus_cutouts() {
    render_if_needed() {
        // Hollow inner path
        translate([0, 0, upper_z ])
            rotate_extrude()
                translate([tip_r, 0, 0])
                    circle(d=tube_id);

        // ARM-TO-RING CHANNEL CONNECTION — uses arm_base for alignment
        // Short bridge from arm straw end to torus hollow; kept within torus wall thickness
        for (a = [0 : arm_step : 359]) {
            arm_base(a)
                translate([0, 0, arm_length - tube_od / 2])
                    cylinder(h = tube_od / 2, d = tube_id);
        }

        // ONE-WAY EXIT HOLES (Downward only)
        for (a = [strut_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, upper_z]) 
                rotate([180, 0, 0]) 
                    cylinder(h=tube_od/2 + 1, d=tube_id + clearance);
        }
    }
}

module connecting_struts_solid() {
    render_if_needed() {
        for (a = [strut_offset : arm_step : 359]) { // Offset by half-step to be halfway between arms
            rotate([0, 0, a])
            translate([tip_r, 0, 0])
                // Main vertical strut body — extends from base to upper torus
                cylinder(h = upper_z, d = tube_od);
        }
    }
}

module connecting_struts_cutouts() {
    render_if_needed() {
        for (a = [strut_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, lower_z])
                // Internal path (The Hole) - cut
                translate([0, 0, -6])
                    cylinder(h = (upper_z - lower_z) + 5, d = tube_id);
        }
    }
}

module lower_torus_solid() {
    render_if_needed() {
        // Solid outer torus
        translate([0, 0, lower_z])
            rotate_extrude() translate([tip_r, 0, 0]) circle(d=tube_od);
    }
}

module lower_torus_cutouts() {
    render_if_needed() {
        // Hollow Inner Path (cut)
        translate([0, 0, lower_z])
            rotate_extrude() translate([tip_r, 0, 0]) circle(d=tube_id);

        // Holes for vertical connectors (cut)
        for (a = [strut_offset : arm_step : 359]) {
            rotate([0, 0, a]) translate([tip_r, 0, lower_z]) // Start at center of tube
                cylinder(h=tube_od, d=tube_id + clearance); // Cut upwards only
        }
    }
}

// Backstop plugs: thin disks perpendicular to the torus channel to block flow.
// These are unioned AFTER the main difference so rotate_extrude cutouts
// don't hollow them out.
backstop_thickness = 1; // disk thickness (mm)

module upper_backstop_plugs() {
    render_if_needed() {
        for (a = [upper_backstop_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, upper_z])
                rotate([90, 0, 0]) // align disk face along torus path (tangent)
                    cylinder(h=backstop_thickness, d=tube_od, center=true);
        }
    }
}

module lower_backstop_plugs() {
    render_if_needed() {
        // One plug per entrance, between the entrance and the nearest strut
        for (a = [lower_backstop_offset : arm_step : 359]) {
            rotate([0, 0, a])
            translate([tip_r, 0, lower_z])
                rotate([90, 0, 0]) // align disk face along torus path (tangent)
                    cylinder(h=backstop_thickness, d=tube_od, center=true);
        }
    }
}

module entrance_holes() {
    // Entrance holes are subtracted last to 'redraw' the openings
    // place the hole centers on the inner face of the torus so they only open to the inside
    entrance_r = tip_r - (tube_od / 2) - 0.5; // slightly inset to sit on inner surface
    hole_depth = (tube_od / 2) + 2; // how far the cutting cylinder penetrates inward
    for (a = [entrance_offset : arm_step : 359]) {
        rotate([0, 0, a])
        translate([entrance_r, 0, lower_z])
        rotate([0, 90, 0]) // Rotate so cylinder points radially
            cylinder(h=hole_depth, d=tube_id + clearance);
    }
}
// Optionally render a cross-section (half) view so you can inspect internals
if (!crosssection_view) {
    liquid_bait_station();
} else {
    // Intersect the model with a very large half-space cube to show only one side
    intersection() {
        liquid_bait_station();
        half_space = torus_dia; // large extent to fully cover the model
        // keep the positive side of the chosen axis starting at crosssection_pos
        if (crosssection_axis == "x")
            translate([crosssection_pos, -half_space, -half_space])
                cube([half_space*2, half_space*2, half_space*2]);
        if (crosssection_axis == "y")
            translate([-half_space, crosssection_pos, -half_space])
                cube([half_space*2, half_space*2, half_space*2]);
        if (crosssection_axis == "z")
            translate([-half_space, -half_space, crosssection_pos])
                cube([half_space*2, half_space*2, half_space*2]);
    }
}

// Helper: conditionally wrap children() with render() when not in preview mode.
// Use this to avoid duplicate code while ensuring expensive geometry is pre-tessellated.
module render_if_needed() {
    if (!preview)
        render() children();
    else
        children();
}
