#!/usr/bin/env python3
"""Redraws the PNG icons and the README logo from icons/icon.svg.

Needs: pip install cairosvg
Run from anywhere: python3 tools/render-icons.py
"""
from pathlib import Path

import cairosvg

root = Path(__file__).resolve().parent.parent
svg = root / "icons" / "icon.svg"

# sizes the browser asks for in manifest.json
for size in (16, 32, 48, 128):
    out = root / "icons" / f"icon{size}.png"
    cairosvg.svg2png(url=str(svg), write_to=str(out), output_width=size, output_height=size)
    print("wrote", out.relative_to(root))

# larger copy for the README
(root / "assets").mkdir(exist_ok=True)
out = root / "assets" / "logo.png"
cairosvg.svg2png(url=str(svg), write_to=str(out), output_width=512, output_height=512)
print("wrote", out.relative_to(root))

