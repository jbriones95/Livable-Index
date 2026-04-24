# ============================================================
# FreeCAD Python Script — Portable Digital Music Player
# ============================================================
# Run via:  Macro > Macros > Create  (paste & execute)
# Requires: FreeCAD 0.19+ with Part workbench
# ============================================================

import FreeCAD
import Part
import math

# ── Helper ───────────────────────────────────────────────────
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

# ============================================================
# 1.  DOCUMENT
# ============================================================
doc = FreeCAD.newDocument("MusicPlayer")

# ============================================================
# 2.  DIMENSIONS (mm)
# ============================================================
body_length   = 50.0      # X — player width
body_width    = 90.0      # Y — player height (taller for gap)
body_thick    = 8.0       # Z — depth / thickness
body_fillet_r = 6.0       # corner radius

scr_length    = 38.0      # screen width
scr_width     = 30.0      # screen height
scr_depth     = 0.6       # recess depth
scr_offset_y  = 22.0      # from body center toward top (pushed UP)

wheel_radius  = 14.0      # click-wheel outer radius
wheel_depth   = 0.4       # slight recess
wheel_y_off   = -18.0     # below body center (pushed DOWN)

btn_radius    = 5.5       # center select button
btn_depth     = 0.3

marker_radius = 1.2       # directional dot size
marker_height = 0.25

# Gap verification:
#   Screen bottom : scr_offset_y - scr_width/2  = 22 - 15  =  7
#   Wheel  top    : wheel_y_off + wheel_radius   = -18 + 14 = -4
#   Clear gap     : 7 - (-4) = 11 mm  ✓

# ============================================================
# 3.  MAIN BODY  (rounded rectangle)
# ============================================================
body = Part.makeBox(body_length, body_width, body_thick)
body.translate(FreeCAD.Vector(-body_length / 2, -body_width / 2, 0))

z_edges = [e for e in body.Edges if abs(e.Length - body_thick) < 0.01]
if z_edges:
    body = body.makeFillet(body_fillet_r, z_edges)

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
    screen = screen.makeFillet(2.0, screen.Edges)
except Exception:
    pass

screen_feat = doc.addObject("Part::Feature", "Screen")
screen_feat.Shape = screen
screen_feat.ViewObject.ShapeColor = (0.15, 0.20, 0.27)
screen_feat.ViewObject.Transparency = 30

body_feat.Shape = body_feat.Shape.cut(screen)

# ============================================================
# 5.  BACK BUTTON  (pill-shaped, in the gap between screen
#     and click-wheel, left of center)
# ============================================================
back_btn_x      = -12.0    # left of center
back_btn_y      =   1.5    # vertically centered in gap
back_btn_width  =  10.0    # pill length (X)
back_btn_height =   4.0    # pill short axis (Y)
back_btn_depth  =   0.5    # raised height

r = back_btn_height / 2

back_box = Part.makeBox(back_btn_width, back_btn_height, back_btn_depth)
back_box.translate(FreeCAD.Vector(
    back_btn_x - back_btn_width / 2,
    back_btn_y - back_btn_height / 2,
    body_thick
))
try:
    z_btn_edges = [e for e in back_box.Edges if abs(e.Length - back_btn_depth) < 0.01]
    if z_btn_edges:
        back_box = back_box.makeFillet(r - 0.1, z_btn_edges)
except Exception:
    pass

back_feat = doc.addObject("Part::Feature", "BackButton")
back_feat.Shape = back_box
back_feat.ViewObject.ShapeColor = (0.18, 0.18, 0.18)

# Back arrow indicator (left-pointing triangle)
back_tri_size  = 2.0
back_tri_depth = 0.1
back_tri = make_triangle(back_tri_size, back_tri_depth)
back_tri.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(0, 0, 1), 180)
back_tri.translate(FreeCAD.Vector(
    back_btn_x - 1.0,
    back_btn_y,
    body_thick + back_btn_depth
))
doc.addObject("Part::Feature", "BackArrow").Shape = back_tri
doc.ActiveObject.ViewObject.ShapeColor = (0.45, 0.45, 0.45)

# Label line next to arrow
back_label = Part.makeBox(3.5, 0.6, 0.1)
back_label.translate(FreeCAD.Vector(
    back_btn_x + 0.5,
    back_btn_y - 0.3,
    body_thick + back_btn_depth
))
doc.addObject("Part::Feature", "BackLabel").Shape = back_label
doc.ActiveObject.ViewObject.ShapeColor = (0.45, 0.45, 0.45)

# ============================================================
# 6.  CLICK-WHEEL (circular recess)
# ============================================================
wheel = Part.makeCylinder(wheel_radius, wheel_depth)
wheel.translate(FreeCAD.Vector(0, wheel_y_off, body_thick - wheel_depth))

wheel_feat = doc.addObject("Part::Feature", "ClickWheel")
wheel_feat.Shape = wheel
wheel_feat.ViewObject.ShapeColor = (0.18, 0.18, 0.18)

body_feat.Shape = body_feat.Shape.cut(wheel)

# ============================================================
# 7.  CENTER SELECT BUTTON (raised disc)
# ============================================================
center_btn = Part.makeCylinder(btn_radius, btn_depth + wheel_depth)
center_btn.translate(FreeCAD.Vector(0, wheel_y_off, body_thick - wheel_depth))

btn_feat = doc.addObject("Part::Feature", "CenterButton")
btn_feat.Shape = center_btn
btn_feat.ViewObject.ShapeColor = (0.14, 0.14, 0.14)

# ============================================================
# 8.  DIRECTIONAL MARKERS (N / S / E / W on wheel)
# ============================================================
positions = {
    "Menu_Top":      ( 0,                  wheel_radius - 3.0),
    "PlayPause_Bot": ( 0,                -(wheel_radius - 3.0)),
    "SkipFwd_Right": ( wheel_radius - 3.0, 0),
    "SkipRev_Left":  (-(wheel_radius - 3.0), 0),
}

for name, (dx, dy) in positions.items():
    m = Part.makeCylinder(marker_radius, marker_height)
    m.translate(FreeCAD.Vector(dx, wheel_y_off + dy, body_thick))
    mf = doc.addObject("Part::Feature", name)
    mf.Shape = m
    mf.ViewObject.ShapeColor = (0.30, 0.30, 0.30)

# ============================================================
# 9.  PLAY / PAUSE ICON (two bars, bottom of wheel)
# ============================================================
bar_w, bar_h, bar_d = 0.6, 2.8, 0.15
for sign in (-1, 1):
    bar = Part.makeBox(bar_w, bar_h, bar_d)
    bar.translate(FreeCAD.Vector(
        sign * 1.0 - bar_w / 2,
        wheel_y_off - (wheel_radius - 3) - bar_h / 2,
        body_thick
    ))
    bf = doc.addObject("Part::Feature",
                       "PlayPauseBar_" + ("R" if sign > 0 else "L"))
    bf.Shape = bar
    bf.ViewObject.ShapeColor = (0.50, 0.50, 0.50)

# ============================================================
# 10. SKIP-FORWARD / SKIP-BACKWARD TRIANGLES
# ============================================================
tri_size  = 2.4
tri_depth = 0.15

for i in range(2):
    tri = make_triangle(tri_size, tri_depth)
    tri.translate(FreeCAD.Vector(
        (wheel_radius - 3) + i * 2.0 - 1.5,
        wheel_y_off, body_thick
    ))
    doc.addObject("Part::Feature", f"FwdTri{i}").Shape = tri
    doc.ActiveObject.ViewObject.ShapeColor = (0.50, 0.50, 0.50)

for i in range(2):
    tri = make_triangle(tri_size, tri_depth)
    tri.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(0, 0, 1), 180)
    tri.translate(FreeCAD.Vector(
        -(wheel_radius - 3) - i * 2.0 + 1.5,
        wheel_y_off, body_thick
    ))
    doc.addObject("Part::Feature", f"RevTri{i}").Shape = tri
    doc.ActiveObject.ViewObject.ShapeColor = (0.50, 0.50, 0.50)

# ============================================================
# 11. MENU INDICATOR (bar at top of wheel)
# ============================================================
menu_bar = Part.makeBox(5.0, 1.0, 0.15)
menu_bar.translate(FreeCAD.Vector(
    -2.5, wheel_y_off + wheel_radius - 4.5, body_thick
))
doc.addObject("Part::Feature", "MenuBar").Shape = menu_bar
doc.ActiveObject.ViewObject.ShapeColor = (0.50, 0.50, 0.50)

# ============================================================
# 12. HOLD SWITCH (slot, top edge)
# ============================================================
slot = Part.makeBox(6.0, 1.2, 1.5)
slot.translate(FreeCAD.Vector(
    body_length / 2 - 10, body_width / 2 - 0.6, body_thick - 1.5
))
body_feat.Shape = body_feat.Shape.cut(slot)

# ============================================================
# 13. HEADPHONE JACK (3.5 mm, right side center)
# ============================================================
# Place the jack on the right side, centered vertically.
jack = Part.makeCylinder(1.75, 3.0)
jack.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(1, 0, 0), 90)
jack.translate(FreeCAD.Vector(body_length / 2 + 0.5, 0, body_thick / 2))
body_feat.Shape = body_feat.Shape.cut(jack)

# Visible ring around the jack (slightly inset on right side)
jack_ring = Part.makeCylinder(2.6, 0.5)
jack_ring.rotate(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(1, 0, 0), 90)
jack_ring.translate(FreeCAD.Vector(body_length / 2, 0, body_thick / 2))
doc.addObject("Part::Feature", "JackRing").Shape = jack_ring
doc.ActiveObject.ViewObject.ShapeColor = (0.35, 0.35, 0.35)

# ============================================================
# 14. USB-C PORT (rectangular slot, centered on bottom edge)
# Approximate USB-C dimensions: ~8.5 x 2.6 mm
# ============================================================
usb_width = 8.5
usb_height = 2.6
usb_depth = 3.0
port = Part.makeBox(usb_width, usb_height, usb_depth)
port.translate(FreeCAD.Vector(-usb_width / 2, -body_width / 2 - 1.0, body_thick / 2 - usb_depth / 2))
body_feat.Shape = body_feat.Shape.cut(port)

# visible lip / recess for the port
port_vis = Part.makeBox(usb_width, 0.5, usb_depth)
port_vis.translate(FreeCAD.Vector(-usb_width / 2, -body_width / 2, body_thick / 2 - usb_depth / 2))
doc.addObject("Part::Feature", "USBPort").Shape = port_vis
doc.ActiveObject.ViewObject.ShapeColor = (0.28, 0.28, 0.28)

# ============================================================
# 15. SCREEN BEZEL (thin frame)
# ============================================================
bezel_outer = Part.makeBox(scr_length + 1.5, scr_width + 1.5, 0.08)
bezel_inner = Part.makeBox(scr_length,       scr_width,       0.08)
bezel_outer.translate(FreeCAD.Vector(
    -(scr_length + 1.5) / 2,
    scr_offset_y - (scr_width + 1.5) / 2,
    body_thick - 0.08
))
bezel_inner.translate(FreeCAD.Vector(
    -scr_length / 2,
    scr_offset_y - scr_width / 2,
    body_thick - 0.08
))
bezel = bezel_outer.cut(bezel_inner)
doc.addObject("Part::Feature", "ScreenBezel").Shape = bezel
doc.ActiveObject.ViewObject.ShapeColor = (0.22, 0.22, 0.22)

# ============================================================
# 16. RECOMPUTE & FIT VIEW
# ============================================================
doc.recompute()

try:
    FreeCAD.Gui.activeDocument().activeView().viewAxonometric()
    FreeCAD.Gui.SendMsgToActiveView("ViewFit")
except Exception:
    pass

print("=" * 55)
print("  Music Player model created successfully!")
print("")
print("  Gap verification:")
print(f"    Screen bottom edge :  Y = {scr_offset_y - scr_width/2:.1f} mm")
print(f"    Wheel  top   edge :  Y = {wheel_y_off + wheel_radius:.1f} mm")
print(f"    Clear gap          : {(scr_offset_y - scr_width/2) - (wheel_y_off + wheel_radius):.1f} mm")
print("=" * 55)
