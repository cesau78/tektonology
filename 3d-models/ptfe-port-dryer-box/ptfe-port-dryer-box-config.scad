// PTFE Dryer Box Port — Shared Configuration

// Performance
preview = false;
$fn = preview ? 32 : 64;

// PTFE tube dimensions (standard 1.75mm filament tube)
ptfe_od        = 4.0;   // outer diameter of PTFE tube
ptfe_clearance = 0.1;   // clearance per side for snug push-fit
hole_dia       = ptfe_od + ptfe_clearance * 2;

// Dryer box wall
dryer_box_thickness = 6.5; // mm — wall thickness of the dryer box

// Filament port — angled section outside the wall where PTFE tube inserts
channel_angle  = 45;    // degrees upward from horizontal
port_dia       = 12.0;  // outer diameter of filament port
socket_depth   = 8.0;   // how far PTFE tube inserts into port
flare_dia      = hole_dia * 2.5; // chamfered opening diameter at tip
flare_depth    = 3.0;            // depth of the chamfer cone

// Wall plug — straight cylinder perpendicular through dryer box wall
plug_dia       = 8.0;   // outer diameter (match drill bit)
plug_z_offset  = 2.0;   // vertical offset to align with filament port

// Flange — vertical disc flush against outside wall surface
flange_dia     = 14.0;  // outer diameter of flange
flange_thick   = 2.0;   // flange thickness
