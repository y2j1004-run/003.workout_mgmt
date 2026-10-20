"""Generate PWA icons into public/ (run: npm run icons)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"
BG = (15, 118, 110)  # teal-700
FG = (255, 255, 255)


def draw_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    # maskable icons need content inside the central 80% safe zone
    s = size * (0.62 if maskable else 0.78)
    cx = cy = size / 2
    bar_h = s * 0.12
    d.rounded_rectangle([cx - s / 2 * 0.62, cy - bar_h / 2, cx + s / 2 * 0.62, cy + bar_h / 2], radius=bar_h / 2, fill=FG)
    for side in (-1, 1):
        for i, (w, h) in enumerate([(s * 0.12, s * 0.62), (s * 0.10, s * 0.42)]):
            x = cx + side * (s * 0.30 + i * s * 0.13)
            d.rounded_rectangle([x - w / 2, cy - h / 2, x + w / 2, cy + h / 2], radius=w * 0.3, fill=FG)
    return img


OUT.mkdir(exist_ok=True)
draw_icon(192, False).save(OUT / "pwa-192x192.png")
draw_icon(512, False).save(OUT / "pwa-512x512.png")
draw_icon(512, True).save(OUT / "maskable-512x512.png")
draw_icon(180, False).save(OUT / "apple-touch-icon.png")
