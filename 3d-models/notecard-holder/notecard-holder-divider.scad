include <notecard-holder-config.scad>
include <perforated-plate.scad>

module divider() {
    perforated_plate(
        p_length    = width,
        p_width     = height,
        p_thickness = plate_thick,
        p_hole_size = hole_dia,
        p_spacing   = spacing,
        p_length_margin = edge_margin,
        p_width_margin  = edge_margin
    );
}

divider();
