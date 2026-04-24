# ============================================================
# FreeCAD Python Script — Portable Digital Music Player
# ============================================================
# Run via:  Macro > Macros > Create  (paste & execute)
# Requires: FreeCAD 0.19+ with Part workbench
# ============================================================

import FreeCAD
import Part
import math

# ── Helpers ──────────────────────────────────────────────────
def make_triangle(size, depth):
    """Equilateral triangle prism pointing right (+X)."""
    h = size * math.sqrt(3) / 2
    pts = [
        FreeCAD.Vector(0, -size / 2, 0),
        FreeCAD.Vector(h,  0,        0),
        FreeCAD.Vector(0,  size / 2, 0),
        FreeCAD.Vector(0, -size / 2, 0),
    ]
    wire = Part.makePolygon(pts)
    face = Part.Face(wire)
    return face.extrude(FreeCAD.Vector(0, 0, depth))


def make_pill(doc, cx, cy, cz, w, h, d, name, color=(0.18, 0.18, 0.18)):
    """
    Pill-shaped raised button.
    cx/cy/cz = center of button face.
    w = thickness into/out of device (X), h = height (Y), d = depth (Z).
    Button is anchored to the side face and protrudes outward.
    """
    b = Part.makeBox(w, h, d)
    b.translate(FreeCAD.Vector(cx - w / 2, cy - h / 2, cz - d / 2))
    try:
        pill_edges = [e for e in b.Edges if abs(e.Length - w) < 0.5
                      or abs(e.Length - d) < 0.5]
        if pill_edges:
            b = b.makeFillet(min(1.8, h / 4, d / 4), pill_edges)
    except Exception:
        pass
    f = doc.addObject("Part::Feature", name)
    f.Shape = b
    f.ViewObject.ShapeColor = color
    return f


# ============================================================
# 1.  DOCUMENT
# ============================================================
# Close any previous MusicPlayer document to ensure a clean rebuild.
try:
    if "MusicPlayer" in FreeCAD.listDocuments():
        FreeCAD.closeDocument("MusicPlayer")
except Exception:
    pass

doc = FreeCAD.newDocument("MusicPlayer")

# ============================================================
# 2.  DIMENSIONS (mm)
# ============================================================
body_length   = 50.0      # X — player width
body_width    = 90.0      # Y — player height
body_thick    = 8.0       # Z — depth / thickness
body_fillet_r = 6.0       # corner radius

scr_length    = 38.0      # screen width
scr_width     = 30.0      # screen height
scr_depth     = 0.8       # recess depth (increased for visibility)
scr_offset_y  = 22.0      # screen center Y (from body center upward)

wheel_radius  = 14.0      # click-wheel outer radius
wheel_depth   = 0.6       # recess depth (increased for visibility)
wheel_y_off   = -18.0     # wheel center Y

btn_radius    = 5.5       # center select button radius
btn_depth     = 0.5       # raised height

marker_radius = 1.2       # directional dot radius
marker_height = 0.3       # dot height

# ============================================================
# 3.  MAIN BODY  (rounded rectangle)
# ============================================================
body = Part.makeBox(body_length, body_width, body_thick)
body.translate(FreeCAD.Vector(-body_length / 2, -body_width / 2, 0))

# Fillet the four vertical (Z-axis) corner edges
z_edges = [e for e in body.Edges if abs(e.Length - body_thick) < 0.01]
if z_edges:
    body = body.makeFillet(body_fillet_r, z_edges)

# Soften the top & bottom face perimeter edges
try:
    perimeter = [e for e in body.Edges
                 if abs(e.Length - body_length) < 2
                 or abs(e.Length - body_width) < 2]
    if perimeter:
        body = body.makeFillet(1.5, perimeter)
except Exception:
    pass

body_feat = doc.addObject("Part::Feature", "Body")
body_feat.Shape = body
body_feat.ViewObject.ShapeColor = (0.10, 0.10, 0.10)

# ============================================================
# 4.  SCREEN RECESS
# ============================================================
screen = Part.makeBox(scr_length, scr_width, scr_depth)
screen.translate(FreeCAD.Vector(
    -scr_length / 2,
    scr_offset_y - scr_width / 2,
    body_thick - scr_depth
))
try:
    screen = screen.makeFillet(2.5, screen.Edges)
except Exception:
    pass

screen_feat = doc.addObject("Part::Feature", "Screen")
screen_feat.Shape = screen
screen_feat.ViewObject.ShapeColor = (0.04, 0.04, 0.06)   # near-black glass
screen_feat.ViewObject.Transparency = 20

body_feat.Shape = body_feat.Shape.cut(screen)

# ============================================================
# 5.  SCREEN BEZEL (visible frame around the screen)
# ============================================================
bezel_t = 1.2                                              # bezel frame thickness
bezel_depth = 0.3                                          # raised above body face
bezel_outer = Part.makeBox(scr_length + bezel_t * 2,
                            scr_width  + bezel_t * 2, bezel_depth)
bezel_inner = Part.makeBox(scr_length, scr_width, bezel_depth + 0.1)
bezel_outer.translate(FreeCAD.Vector(
    -(scr_length + bezel_t * 2) / 2,
    scr_offset_y - (scr_width + bezel_t * 2) / 2,
    body_thick - bezel_depth
))
bezel_inner.translate(FreeCAD.Vector(
    -scr_length / 2,
    scr_offset_y - scr_width / 2,
    body_thick - bezel_depth - 0.05
))
bezel = bezel_outer.cut(bezel_inner)
try:
    bezel = bezel.makeFillet(0.6, bezel.Edges)
except Exception:
    pass
doc.addObject("Part::Feature", "ScreenBezel").Shape = bezel
doc.ActiveObject.ViewObject.ShapeColor = (0.20, 0.20, 0.20)

# ============================================================
# 6.  BACK BUTTON (pill-shaped, between screen and wheel)
# ============================================================
back_btn_x      = -12.0
back_btn_y      =   1.5
back_btn_width  =  10.0
back_btn_height =   4.5
back_btn_depth  =   0.6
back_fillet_r   = back_btn_height / 2 - 0.1

back_box = Part.makeBox(back_btn_width, back_btn_height, back_btn_depth)
back_box.translate(FreeCAD.Vector(
    back_btn_x - back_btn_width / 2,
    back_btn_y - back_btn_height / 2,
    body_thick
))
try:
    z_btn_edges = [e for e in back_box.Edges
                   if abs(e.Length - back_btn_depth) < 0.01]
    if z_btn_edges:
        back_box = back_box.makeFillet(back_fillet_r, z_btn_edges)
except Exception:
    pass

back_feat = doc.addObject("Part::Feature", "BackButton")
back_feat.Shape = back_box
back_feat.ViewObject.ShapeColor = (0.20, 0.20, 0.20)

# Back arrow (left-pointing triangle) on button face
back_tri = make_triangle(2.0, 0.12)
back_tri.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(0, 0, 1), 180)
back_tri.translate(FreeCAD.Vector(
    back_btn_x - 1.0,
    back_btn_y,
    body_thick + back_btn_depth
))
doc.addObject("Part::Feature", "BackArrow").Shape = back_tri
doc.ActiveObject.ViewObject.ShapeColor = (0.50, 0.50, 0.50)

# ============================================================
# 7.  CLICK-WHEEL RING (outer ring, recessed into body)
# ============================================================
# Outer decorative ring to frame the wheel
wheel_ring_outer = Part.makeCylinder(wheel_radius + 1.5, wheel_depth)
wheel_ring_inner = Part.makeCylinder(wheel_radius,       wheel_depth + 0.1)
wheel_ring_outer.translate(FreeCAD.Vector(0, wheel_y_off, body_thick - wheel_depth))
wheel_ring_inner.translate(FreeCAD.Vector(0, wheel_y_off, body_thick - wheel_depth - 0.05))
wheel_ring = wheel_ring_outer.cut(wheel_ring_inner)

wheel_ring_feat = doc.addObject("Part::Feature", "WheelRing")
wheel_ring_feat.Shape = wheel_ring
wheel_ring_feat.ViewObject.ShapeColor = (0.14, 0.14, 0.14)
body_feat.Shape = body_feat.Shape.cut(wheel_ring_outer)

# ============================================================
# 8.  CLICK-WHEEL DISC (recessed inner disc)
# ============================================================
wheel = Part.makeCylinder(wheel_radius, wheel_depth)
wheel.translate(FreeCAD.Vector(0, wheel_y_off, body_thick - wheel_depth))

wheel_feat = doc.addObject("Part::Feature", "ClickWheel")
wheel_feat.Shape = wheel
wheel_feat.ViewObject.ShapeColor = (0.16, 0.16, 0.16)

body_feat.Shape = body_feat.Shape.cut(wheel)

# ============================================================
# 9.  CENTER SELECT BUTTON (raised disc inside wheel)
# ============================================================
center_btn = Part.makeCylinder(btn_radius, btn_depth + wheel_depth)
center_btn.translate(FreeCAD.Vector(0, wheel_y_off, body_thick - wheel_depth))

btn_feat = doc.addObject("Part::Feature", "CenterButton")
btn_feat.Shape = center_btn
btn_feat.ViewObject.ShapeColor = (0.13, 0.13, 0.13)

# ============================================================
# 10. DIRECTIONAL MARKERS (dots at N / S / E / W on wheel)
# ============================================================
marker_positions = {
    "Menu_Top":      ( 0,                   wheel_radius - 3.5),
    "PlayPause_Bot": ( 0,                 -(wheel_radius - 3.5)),
    "SkipFwd_Right": ( wheel_radius - 3.5,  0),
    "SkipRev_Left":  (-(wheel_radius - 3.5), 0),
}

for mname, (dx, dy) in marker_positions.items():
    m = Part.makeCylinder(marker_radius, marker_height)
    m.translate(FreeCAD.Vector(dx, wheel_y_off + dy, body_thick))
    mf = doc.addObject("Part::Feature", mname)
    mf.Shape = m
    mf.ViewObject.ShapeColor = (0.35, 0.35, 0.35)

# ============================================================
# 11. PLAY / PAUSE ICON (two vertical bars at bottom of wheel)
# ============================================================
bar_w, bar_h, bar_d = 0.7, 3.0, 0.18
for sign in (-1, 1):
    bar = Part.makeBox(bar_w, bar_h, bar_d)
    bar.translate(FreeCAD.Vector(
        sign * 1.1 - bar_w / 2,
        wheel_y_off - (wheel_radius - 3.5) - bar_h / 2,
        body_thick
    ))
    bname = "PlayPauseBar_" + ("R" if sign > 0 else "L")
    bf = doc.addObject("Part::Feature", bname)
    bf.Shape = bar
    bf.ViewObject.ShapeColor = (0.45, 0.45, 0.45)

# ============================================================
# 12. SKIP-FORWARD / SKIP-BACKWARD TRIANGLES (on wheel face)
# ============================================================
tri_size  = 2.6
tri_depth = 0.18

# >> Forward (right side, two chevrons)
for i in range(2):
    tri = make_triangle(tri_size, tri_depth)
    tri.translate(FreeCAD.Vector(
        (wheel_radius - 3.5) + i * 2.2 - 1.6,
        wheel_y_off,
        body_thick
    ))
    doc.addObject("Part::Feature", f"FwdTri{i}").Shape = tri
    doc.ActiveObject.ViewObject.ShapeColor = (0.45, 0.45, 0.45)

# << Backward (left side, two chevrons)
for i in range(2):
    tri = make_triangle(tri_size, tri_depth)
    tri.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(0, 0, 1), 180)
    tri.translate(FreeCAD.Vector(
        -(wheel_radius - 3.5) - i * 2.2 + 1.6,
        wheel_y_off,
        body_thick
    ))
    doc.addObject("Part::Feature", f"RevTri{i}").Shape = tri
    doc.ActiveObject.ViewObject.ShapeColor = (0.45, 0.45, 0.45)

# ============================================================
# 13. MENU INDICATOR BAR (top of wheel face)
# ============================================================
menu_bar = Part.makeBox(5.5, 1.2, 0.18)
menu_bar.translate(FreeCAD.Vector(
    -2.75, wheel_y_off + wheel_radius - 4.8, body_thick
))
doc.addObject("Part::Feature", "MenuBar").Shape = menu_bar
doc.ActiveObject.ViewObject.ShapeColor = (0.45, 0.45, 0.45)

# ============================================================
# 14. VOLUME ROCKER  (left side — two pill buttons)
# ============================================================
# Buttons are anchored flush to the left face (X = -body_length/2) and
# protrude outward in the -X direction.
vol_protrusion = 1.8    # how far buttons stick out from the body side
vol_h = 12.0            # button height (Y)
vol_d = 4.5             # button span along body thickness (Z)
vol_z  = body_thick / 2 # centered on device thickness

# VolUp: upper button, aligned with screen upper area
vol_cy_top    = scr_offset_y + 2.0
vol_cy_bottom = vol_cy_top - 16.0   # 16 mm gap between the two buttons

# cx for pill: we want the right face flush with -body_length/2, so
# center is at -body_length/2 - vol_protrusion/2
vol_cx = -body_length / 2 - vol_protrusion / 2

make_pill(doc, vol_cx, vol_cy_top,    vol_z, vol_protrusion, vol_h, vol_d,
          "VolUp",   color=(0.20, 0.20, 0.20))
make_pill(doc, vol_cx, vol_cy_bottom, vol_z, vol_protrusion, vol_h, vol_d,
          "VolDown", color=(0.20, 0.20, 0.20))

# ============================================================
# 15. POWER BUTTON  (right side — single pill button)
# ============================================================
# Anchored flush to the right face (X = +body_length/2), protrudes outward.
pwr_protrusion = 2.0
pwr_h = 8.0
pwr_d = 4.0
pwr_cx = body_length / 2 + pwr_protrusion / 2
pwr_cy = scr_offset_y - 4.0   # slightly below the screen center
pwr_cz = body_thick / 2

make_pill(doc, pwr_cx, pwr_cy, pwr_cz, pwr_protrusion, pwr_h, pwr_d,
          "PowerBtn", color=(0.20, 0.20, 0.20))

# ============================================================
# 16. USB-C PORT  (functional cut, centered on bottom edge)
# ============================================================
usb_width  = 8.5
usb_height = 2.6
usb_depth  = 3.5   # depth into body

port_cut = Part.makeBox(usb_width, usb_height, usb_depth)
port_cut.translate(FreeCAD.Vector(
    -usb_width / 2,
    -body_width / 2 - 1.0,
    body_thick / 2 - usb_depth / 2
))
body_feat.Shape = body_feat.Shape.cut(port_cut)

# Thin bezel around USB-C opening
usb_bezel = Part.makeBox(usb_width + 1.5, 0.6, usb_depth + 1.5)
usb_bezel_inner = Part.makeBox(usb_width, 0.6 + 0.1, usb_depth)
usb_bezel.translate(FreeCAD.Vector(
    -(usb_width + 1.5) / 2, -body_width / 2, body_thick / 2 - (usb_depth + 1.5) / 2
))
usb_bezel_inner.translate(FreeCAD.Vector(
    -usb_width / 2, -body_width / 2 - 0.05, body_thick / 2 - usb_depth / 2
))
usb_bezel_shape = usb_bezel.cut(usb_bezel_inner)
doc.addObject("Part::Feature", "USBBezel").Shape = usb_bezel_shape
doc.ActiveObject.ViewObject.ShapeColor = (0.28, 0.28, 0.28)

# ============================================================
# 17. HEADPHONE JACK  (functional 3.5 mm cut, right of USB-C)
# ============================================================
jack_radius = 1.75
jack_depth  = 4.5
jack_x_offset = usb_width / 2 + 8.0   # clear of USB-C with comfortable gap

# Through-cut into the body
jack_cut = Part.makeCylinder(jack_radius, jack_depth)
jack_cut.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(1, 0, 0), 90)
jack_cut.translate(FreeCAD.Vector(jack_x_offset, -body_width / 2 - 1.5, body_thick / 2))
body_feat.Shape = body_feat.Shape.cut(jack_cut)

# Internal grooves (ridges) — three annular cuts along the hole depth
for gd in [0.8, 1.8, 2.8]:
    groove = Part.makeCylinder(jack_radius + 0.35, 0.15)
    groove.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(1, 0, 0), 90)
    groove.translate(FreeCAD.Vector(jack_x_offset, -body_width / 2 - 1.5 + gd, body_thick / 2))
    body_feat.Shape = body_feat.Shape.cut(groove)

# External stepped flange (plated ring visible on the device bottom)
# Each step is a concentric hollow ring, widest outermost, narrowing inward.
flange_steps = [
    (jack_radius + 2.2, jack_radius + 1.6, 0.35),   # (outer_r, inner_r, height)
    (jack_radius + 1.6, jack_radius + 1.0, 0.28),
    (jack_radius + 1.0, jack_radius + 0.4, 0.20),
]
flange_shapes = []
for outer_r, inner_r, flange_h in flange_steps:
    outer_cyl = Part.makeCylinder(outer_r, flange_h)
    inner_cyl = Part.makeCylinder(inner_r, flange_h + 0.1)
    outer_cyl.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(1, 0, 0), 90)
    inner_cyl.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(1, 0, 0), 90)
    outer_cyl.translate(FreeCAD.Vector(jack_x_offset, -body_width / 2,       body_thick / 2 - flange_h / 2))
    inner_cyl.translate(FreeCAD.Vector(jack_x_offset, -body_width / 2 - 0.05, body_thick / 2 - flange_h / 2))
    ring = outer_cyl.cut(inner_cyl)
    flange_shapes.append(ring)

flange_shape = flange_shapes[0]
for s in flange_shapes[1:]:
    flange_shape = flange_shape.fuse(s)

doc.addObject("Part::Feature", "JackFlange").Shape = flange_shape
doc.ActiveObject.ViewObject.ShapeColor = (0.38, 0.38, 0.38)

# ============================================================
# 18. RECOMPUTE & FIT VIEW
# ============================================================
doc.recompute()

try:
    FreeCAD.Gui.activeDocument().activeView().viewAxonometric()
    FreeCAD.Gui.SendMsgToActiveView("ViewFit")
except Exception:
    pass  # headless / CLI mode

print("=" * 55)
print("  Music Player model created successfully!")
print("")
print("  Components:")
print("    Body, ScreenBezel, Screen, BackButton, BackArrow")
print("    WheelRing, ClickWheel, CenterButton")
print("    Markers (N/S/E/W), Play/Pause, Skip triangles")
print("    MenuBar, VolUp, VolDown, PowerBtn")
print("    USB-C port + bezel, 3.5mm Jack + flange + grooves")
print("")
print("  Key dimensions (mm):")
print(f"    Body         : {body_length} x {body_width} x {body_thick}")
print(f"    Screen       : {scr_length} x {scr_width}, center Y={scr_offset_y}")
print(f"    Wheel center : Y={wheel_y_off}, R={wheel_radius}")
print(f"    Gap (screen-bottom to wheel-top): "
      f"{(scr_offset_y - scr_width/2) - (wheel_y_off + wheel_radius):.1f} mm")
print(f"    USB-C        : {usb_width} x {usb_height} mm, centered X=0")
print(f"    Jack         : R={jack_radius} mm, X={jack_x_offset:.1f} mm")
print("=" * 55)
