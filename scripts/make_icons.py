"""Generate PWA icons into public/ (run: npm run icons)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"
BG = (15, 118, 110)  # teal-700
FG = (255, 255, 255)
SUPERSAMPLE = 4

# A runner facing right, in a unit box (x right, y down): head, then limbs as joint chains.
HEAD = ((0.64, 0.12), 0.105)
SHOULDER = (0.55, 0.30)
HIP = (0.45, 0.56)
LIMBS = [
    [SHOULDER, HIP],  # torso
    [SHOULDER, (0.71, 0.42), (0.83, 0.33)],  # front arm
    [SHOULDER, (0.38, 0.40), (0.26, 0.50)],  # back arm
    [HIP, (0.66, 0.68), (0.60, 0.92)],  # front leg
    [HIP, (0.36, 0.76), (0.16, 0.80)],  # back leg
]
LIMB_WIDTH = 0.11


def draw_icon(size: int, maskable: bool) -> Image.Image:
    big = size * SUPERSAMPLE
    img = Image.new("RGB", (big, big), BG)
    d = ImageDraw.Draw(img)
    # maskable icons need content inside the central 80% safe zone
    s = big * (0.60 if maskable else 0.74)
    ox = oy = (big - s) / 2

    def pt(p):
        return (ox + p[0] * s, oy + p[1] * s)

    w = LIMB_WIDTH * s
    for chain in LIMBS:
        pts = [pt(p) for p in chain]
        d.line(pts, fill=FG, width=round(w), joint="curve")
        for x, y in pts:  # round ends and joints
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=FG)
    (hx, hy), r = HEAD
    cx, cy = pt((hx, hy))
    d.ellipse([cx - r * s, cy - r * s, cx + r * s, cy + r * s], fill=FG)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
draw_icon(192, False).save(OUT / "pwa-192x192.png")
draw_icon(512, False).save(OUT / "pwa-512x512.png")
draw_icon(512, True).save(OUT / "maskable-512x512.png")
draw_icon(180, False).save(OUT / "apple-touch-icon.png")
