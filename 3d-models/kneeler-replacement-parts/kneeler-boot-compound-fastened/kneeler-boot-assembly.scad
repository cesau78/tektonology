// --- TEKTONOLOGY KNEELER BOOT — ASSEMBLY / INTERFERENCE VIEW ---
// Diagnostic visualization: renders cap and slipper together to reveal
// interference (overlapping material) between the two parts.
//
// mode = "interference"  →  ghost parts + solid red overlap volume
// mode = "assembly"      →  both parts colored, no overlap highlight

mode = "interference"; // "interference" or "assembly"

include <kneeler-boot-config.scad>
use <kneeler-boot-cap.scad>
use <kneeler-boot-slipper.scad>

if (mode == "interference") {
    // Ghost both parts (transparent)
    %cap();
    %slipper();

    // Solid red: only the volume where both parts occupy the same space
    color("red") intersection() {
        cap();
        slipper();
    }
} else {
    // Simple assembly view
    color("SteelBlue", 0.1) cap();
    color("SlateGray", 0.1) slipper();
}
