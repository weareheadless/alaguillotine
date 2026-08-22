#!/usr/bin/env python3
"""
generate-og-image.py — renders public/og-image.png, the link-preview card for
fuckyouelon.net (1200x630, the OpenGraph / Bluesky card size).

The card shows the gamified guillotine: two posts, a beam, an angled blade,
a progress bar, and the brand. It is drawn deterministically with Pillow so it
can be regenerated at any time and audited six months from now.

Run:  python3 scripts/generate-og-image.py        # writes public/og-image.png
Requires: Pillow (python3 -m pip install Pillow) and DejaVu fonts.

Design tokens mirror src/app/globals.css:
  canvasBlack  #0B0B0C   sheetWhite #F4F4F5   spiteCrimson #E11D48
  hypeNeon     #22C55E   glitchGray #27272A   chopMuted    #71717A
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1200, 630
OUT = Path(__file__).resolve().parent.parent / "public" / "og-image.png"

CANVAS = (11, 11, 12)        # #0B0B0C
SHEET = (244, 244, 245)      # #F4F4F5
CRIMSON = (225, 29, 72)      # #E11D48
NEON = (34, 197, 94)         # #22C55E
GRAY = (39, 39, 42)          # #27272A
MUTED = (113, 113, 122)      # #71717A
BLACK = (0, 0, 0)

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
MONO_BOLD = FONT_DIR / "DejaVuSansMono-Bold.ttf"
SANS_BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def fill_rounded(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_grid(draw: ImageDraw.ImageDraw):
    step = 48
    for x in range(0, WIDTH, step):
        draw.line([(x, 0), (x, HEIGHT)], fill=GRAY + (36,), width=1)
    for y in range(0, HEIGHT, step):
        draw.line([(0, y), (WIDTH, y)], fill=GRAY + (36,), width=1)


def draw_guillotine(draw: ImageDraw.ImageDraw):
    cx = WIDTH // 2
    post_w, post_h = 26, 300
    left_x, right_x = cx - 150, cx + 124
    beam_y, base_y = 150, 430

    # Posts.
    draw.rectangle([left_x, beam_y + 16, left_x + post_w, beam_y + post_h], fill=GRAY, outline=BLACK, width=2)
    draw.rectangle([right_x, beam_y + 16, right_x + post_w, beam_y + post_h], fill=GRAY, outline=BLACK, width=2)

    # Top beam + base.
    draw.rectangle([left_x - 10, beam_y, right_x + post_w + 10, beam_y + 34], fill=GRAY, outline=BLACK, width=2)
    draw.rectangle([left_x - 24, base_y, right_x + post_w + 24, base_y + 44], fill=GRAY, outline=BLACK, width=2)

    # Lunette (the neck hole) — darker inset on the base block.
    draw.rounded_rectangle([cx - 34, base_y - 8, cx + 34, base_y + 12], radius=16, fill=BLACK)

    # Blade: an angled trapezoid from just under the beam to the base.
    blade = [(cx - 78, beam_y + 44), (cx + 78, beam_y + 44), (cx + 52, base_y + 6), (cx - 52, base_y + 6)]
    draw.polygon(blade, fill=CRIMSON, outline=SHEET)
    draw.polygon([(cx - 78, beam_y + 44), (cx - 40, beam_y + 44), (cx - 52, base_y + 6)], fill=(236, 72, 108))

    # Progress bar beside the blade (the gamified counter).
    bar_x, bar_y0, bar_y1 = cx + 92, beam_y + 30, base_y
    bar_w = 10
    draw.rectangle([bar_x, bar_y0, bar_x + bar_w, bar_y1], fill=BLACK)
    fill_frac = 0.62
    fill_y1 = bar_y1 - int((bar_y1 - bar_y0) * fill_frac)
    draw.rectangle([bar_x, fill_y1, bar_x + bar_w, bar_y1], fill=NEON)
    for t in (0.25, 0.5, 0.75):
        y = bar_y0 + int((bar_y1 - bar_y0) * t)
        draw.line([(bar_x - 3, y), (bar_x + bar_w + 3, y)], fill=SHEET, width=2)
    draw.text((bar_x - 8, bar_y0 - 18), "100%", font=font(MONO_BOLD, 14), fill=SHEET, anchor="rm")
    draw.text((bar_x - 8, bar_y1 - 4), "0%", font=font(MONO_BOLD, 14), fill=SHEET, anchor="rm")

    # Digital artifacts / sparks near the blade.
    draw.rectangle([cx - 60, beam_y + 66, cx - 54, beam_y + 72], fill=CRIMSON)
    draw.rectangle([cx + 40, beam_y + 96, cx + 48, beam_y + 100], fill=NEON)
    draw.rectangle([cx - 30, base_y - 52, cx - 25, base_y - 46], fill=SHEET)


def draw_text(draw: ImageDraw.ImageDraw):
    # Brand: FUCKYOU (sheet) + ELON (crimson).
    brand = font(MONO_BOLD, 74)
    label = font(MONO_BOLD, 22)
    tag = font(MONO_BOLD, 26)

    fuckyou = "FUCKYOU"
    elon = "ELON"
    fw, _ = draw.textsize(fuckyou, font=brand) if hasattr(draw, "textsize") else (0, 0)
    try:
        fw = draw.textlength(fuckyou, font=brand)
    except AttributeError:
        pass
    total = fw + draw.textlength(elon, font=brand) + 8
    x0 = (WIDTH - total) / 2
    draw.text((x0, 34), fuckyou, font=brand, fill=SHEET)
    draw.text((x0 + fw + 8, 34), elon, font=brand, fill=CRIMSON)

    # $CHOP PROTOCOL pill.
    pill = "$CHOP PROTOCOL"
    pw = draw.textlength(pill, font=label)
    px, py = (WIDTH - pw) / 2 - 26, 124
    fill_rounded(draw, [px, py, px + pw + 52, py + 38], radius=6, fill=(31, 32, 35), outline=CRIMSON, width=2)
    draw.text((px + 26, py + 19), pill, font=label, fill=CRIMSON, anchor="lm")

    # Tagline under the guillotine.
    tagline = "POST YOUR BEEF. EVERY MESSAGE INCHES THE BLADE CLOSER."
    draw.text((WIDTH / 2, 510), tagline, font=tag, fill=MUTED, anchor="mm")
    draw.text((WIDTH / 2, 556), "ONE WALLET. ONE VOTE. INFINITE SPITE.", font=tag, fill=SHEET, anchor="mm")


def render() -> Path:
    img = Image.new("RGBA", (WIDTH, HEIGHT), CANVAS + (255,))
    draw = ImageDraw.Draw(img)
    draw_grid(draw)
    draw_guillotine(draw)
    draw_text(draw)
    out = img.convert("RGB")
    out.save(OUT, "PNG")
    return OUT


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Render the fuckyouelon.net OpenGraph card.")
    parser.add_argument("--out", default=str(OUT), help="output PNG path")
    args = parser.parse_args()
    path = Path(args.out)
    img = Image.new("RGBA", (WIDTH, HEIGHT), CANVAS + (255,))
    draw = ImageDraw.Draw(img)
    draw_grid(draw)
    draw_guillotine(draw)
    draw_text(draw)
    img.convert("RGB").save(path, "PNG")
    print(f"wrote {path} ({WIDTH}x{HEIGHT})")