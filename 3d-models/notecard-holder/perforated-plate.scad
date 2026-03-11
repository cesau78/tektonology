// --- TEKTONOLOGY PERFORATED PLATE ---
// Reusable hex-packed perforated plate module.
//
// Arguments:
//   p_length    – plate length along X (mm)
//   p_width     – plate width along Y (mm)
//   p_thickness – plate thickness along Z (mm)
//   p_hole_size – hole diameter (mm)
//   p_spacing       – center-to-center hole spacing; defaults to hole_size + 2
//   p_length_margin – margin along X (length) edges; defaults to hole_size
//   p_width_margin  – margin along Y (width) edges; defaults to hole_size

module perforated_plate(p_length, p_width, p_thickness, p_hole_size,
                        p_spacing = undef, p_length_margin = undef,
                        p_width_margin = undef) {

    _spacing    = is_undef(p_spacing)       ? p_hole_size + 2 : p_spacing;
    _x_margin   = is_undef(p_length_margin) ? p_hole_size     : p_length_margin;
    _y_margin   = is_undef(p_width_margin)  ? p_hole_size     : p_width_margin;

    _row_spacing = _spacing * sin(60);           // hex-pack Y stride
    _stagger     = _spacing / 2;                 // odd-row X offset

    // Max center-to-center span that fits within margins (accounting for hole radius)
    _avail_x = p_length - 2 * _x_margin - p_hole_size;
    _avail_y = p_width  - 2 * _y_margin - p_hole_size;

    // Column count accounts for stagger so odd rows stay within margin
    _cols = floor((_avail_x - _stagger) / _spacing) + 1;
    _rows = floor(_avail_y / _row_spacing) + 1;

    // Bounding box of all hole centers (even rows start at 0, odd rows at +stagger)
    _pattern_x = (_cols - 1) * _spacing + _stagger;
    _pattern_y = (_rows - 1) * _row_spacing;

    // Center the bounding box within the plate
    _x0 = (p_length - _pattern_x) / 2;
    _y0 = (p_width  - _pattern_y) / 2;

    difference() {
        cube([p_length, p_width, p_thickness]);

        for (r = [0 : _rows - 1])
            for (c = [0 : _cols - 1])
                translate([
                    _x0 + c * _spacing + (r % 2) * _stagger,
                    _y0 + r * _row_spacing,
                    -0.1
                ])
                    cylinder(h = p_thickness + 0.2, d = p_hole_size, $fn = $fn);
    }
}
