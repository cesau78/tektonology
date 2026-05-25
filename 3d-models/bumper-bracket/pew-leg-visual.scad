// Assembly ghost — nominal pew leg 18" × 18" × 1½".
// Local +Z = thickness; plan in XY. assembly.scad uses Ry(90°) to stand it vertical.

module pew_leg_visual_for_exploded_view() {
    cube(
        [pew_leg_visual_plan_mm, pew_leg_visual_plan_mm, pew_leg_thickness_mm],
        center = true
    );
}
