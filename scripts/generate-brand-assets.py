#!/usr/bin/env python3
"""
GSTPilot Brand Identity System — Asset Generator
Derives all logo variants + favicon set from the official uploaded logo.
"""
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = '/home/z/my-project/upload/pasted_image_1782212751517.png'
BRAND_DIR = '/home/z/my-project/public/brand'
PUBLIC_DIR = '/home/z/my-project/public'

# Layout (from pixel analysis of the 2230x1536 source)
ICON_X1, ICON_X2 = 714, 1544
ICON_Y1, ICON_Y2 = 248, 842
FULL_X1, FULL_X2 = 611, 1660
FULL_Y1, FULL_Y2 = 248, 1234

os.makedirs(BRAND_DIR, exist_ok=True)


def load_rgba(path):
    return Image.open(path).convert('RGBA')


def to_array(img):
    return np.array(img)


def make_black_transparent(img):
    arr = to_array(img).astype(np.float32)
    rgb = arr[:, :, :3]
    luminance = rgb.sum(axis=2) / 3.0
    alpha = np.clip((luminance - 8) * (255.0 / 32.0), 0, 255).astype(np.uint8)
    alpha[luminance >= 40] = 255
    out = np.zeros_like(arr, dtype=np.uint8)
    out[:, :, :3] = rgb.astype(np.uint8)
    out[:, :, 3] = alpha
    return Image.fromarray(out, 'RGBA')


def feather_edges(img, radius=1):
    arr = to_array(img).astype(np.float32)
    alpha = arr[:, :, 3]
    alpha_img = Image.fromarray(alpha.astype(np.uint8), 'L')
    alpha_blur = alpha_img.filter(ImageFilter.GaussianBlur(radius=radius))
    arr[:, :, 3] = np.array(alpha_blur).astype(np.float32)
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


def crop_icon(src_img, padding=0):
    w, h = src_img.size
    x1, y1, x2, y2 = ICON_X1 - padding, ICON_Y1 - padding, ICON_X2 + padding, ICON_Y2 + padding
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    return src_img.crop((x1, y1, x2, y2))


def crop_full(src_img, padding=0):
    w, h = src_img.size
    x1, y1, x2, y2 = FULL_X1 - padding, FULL_Y1 - padding, FULL_X2 + padding, FULL_Y2 + padding
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    return src_img.crop((x1, y1, x2, y2))


def square_pad(img, size, bg=(0, 0, 0, 255)):
    canvas = Image.new('RGBA', (size, size), bg)
    w, h = img.size
    scale = min(size * 0.82 / w, size * 0.82 / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    offset = ((size - new_w) // 2, (size - new_h) // 2)
    canvas.paste(resized, offset, resized if resized.mode == 'RGBA' else None)
    return canvas


def make_white_version(img):
    arr = to_array(img).astype(np.float32)
    alpha = arr[:, :, 3]
    out = np.zeros_like(arr, dtype=np.uint8)
    out[:, :, 0] = 255
    out[:, :, 1] = 255
    out[:, :, 2] = 255
    out[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def save_png(img, path, optimize=True):
    img.save(path, 'PNG', optimize=optimize)
    print(f"  saved {path} ({img.size[0]}x{img.size[1]})")


print("=" * 70)
print("GSTPilot Brand Identity System — Asset Generator")
print("=" * 70)

src = load_rgba(SRC)
print(f"\nLoaded source: {SRC} ({src.size[0]}x{src.size[1]})")

# 1. Icon variants
print("\n[1/8] Generating icon variants...")
icon_crop = crop_icon(src, padding=12)
icon_transparent = make_black_transparent(icon_crop)
icon_transparent = feather_edges(icon_transparent, radius=0.8)

icon_512 = square_pad(icon_transparent, 512, bg=(0, 0, 0, 0))
save_png(icon_512, f'{BRAND_DIR}/gstpilot-icon-transparent.png')

icon_black_bg = square_pad(icon_crop, 1048, bg=(0, 0, 0, 255))
save_png(icon_black_bg, f'{BRAND_DIR}/gstpilot-icon.png')

icon_white = make_white_version(icon_transparent)
icon_white_512 = square_pad(icon_white, 512, bg=(0, 0, 0, 0))
save_png(icon_white_512, f'{BRAND_DIR}/gstpilot-icon-white.png')

# 2. Full logo
print("\n[2/8] Generating full logo variants...")
full_crop = crop_full(src, padding=20)
full_transparent = make_black_transparent(full_crop)
full_transparent = feather_edges(full_transparent, radius=0.8)
save_png(full_transparent, f'{BRAND_DIR}/gstpilot-logo-full-transparent.png')

full_black_bg = crop_full(src, padding=20)
full_padded = Image.new('RGBA', (full_black_bg.size[0] + 40, full_black_bg.size[1] + 40), (0, 0, 0, 255))
full_padded.paste(full_black_bg, (20, 20))
save_png(full_padded, f'{BRAND_DIR}/gstpilot-logo-full.png')

# 3. Splash
print("\n[3/8] Generating splash screen...")
splash = square_pad(icon_crop, 1024, bg=(0, 0, 0, 255))
save_png(splash, f'{BRAND_DIR}/gstpilot-splash.png')

# 4. Favicons
print("\n[4/8] Generating favicon set...")
fav16 = square_pad(icon_transparent, 16, bg=(0, 0, 0, 255))
save_png(fav16, f'{PUBLIC_DIR}/favicon-16x16.png')
fav32 = square_pad(icon_transparent, 32, bg=(0, 0, 0, 255))
save_png(fav32, f'{PUBLIC_DIR}/favicon-32x32.png')
apple180 = square_pad(icon_crop, 180, bg=(0, 0, 0, 255))
save_png(apple180, f'{PUBLIC_DIR}/apple-touch-icon.png')
android192 = square_pad(icon_crop, 192, bg=(0, 0, 0, 255))
save_png(android192, f'{PUBLIC_DIR}/android-chrome-192.png')
android512 = square_pad(icon_crop, 512, bg=(0, 0, 0, 255))
save_png(android512, f'{PUBLIC_DIR}/android-chrome-512.png')

# 5. favicon.ico
print("\n[5/8] Generating favicon.ico...")
ico_sizes = [16, 32, 48]
ico_imgs = [square_pad(icon_transparent, s, bg=(0, 0, 0, 255)) for s in ico_sizes]
ico_imgs[0].save(f'{PUBLIC_DIR}/favicon.ico', format='ICO',
                  sizes=[(s, s) for s in ico_sizes], append_images=ico_imgs[1:])
print(f"  saved {PUBLIC_DIR}/favicon.ico")

# 6. og-image
print("\n[6/8] Generating og-image.png (1200x630)...")
og = Image.new('RGBA', (1200, 630), (0, 0, 0, 255))
full_w, full_h = full_transparent.size
target_w = 720
scale = target_w / full_w
target_h = int(full_h * scale)
og_logo = full_transparent.resize((target_w, target_h), Image.LANCZOS)
glow = og_logo.filter(ImageFilter.GaussianBlur(radius=30))
glow_arr = np.array(glow).astype(np.float32)
glow_arr[:, :, 3] = glow_arr[:, :, 3] * 0.45
glow_img = Image.fromarray(glow_arr.astype(np.uint8), 'RGBA')
og.paste(glow_img, ((1200 - target_w) // 2, (630 - target_h) // 2), glow_img)
og.paste(og_logo, ((1200 - target_w) // 2, (630 - target_h) // 2), og_logo)
save_png(og, f'{PUBLIC_DIR}/og-image.png')

# 7. SVGs
print("\n[7/8] Generating icon.svg + logo-full.svg...")
BRAND_BLUE = '#10B0F0'
BRAND_PURPLE = '#7040D0'
BRAND_CYAN = '#22D3EE'

icon_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="gBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
    <linearGradient id="gBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{BRAND_CYAN}"/>
      <stop offset="100%" stop-color="{BRAND_BLUE}"/>
    </linearGradient>
    <linearGradient id="gPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{BRAND_PURPLE}"/>
      <stop offset="100%" stop-color="#9F67E0"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#gBg)"/>
  <circle cx="256" cy="256" r="128" fill="none" stroke="url(#gBlue)" stroke-width="40"
          stroke-dasharray="540 360" stroke-linecap="round" transform="rotate(-90 256 256)"
          filter="url(#glow)"/>
  <path d="M 256 150 L 332 226 L 290 226 L 290 312 L 222 312 L 222 226 L 180 226 Z"
        fill="url(#gPurple)" filter="url(#glow)"/>
  <circle cx="256" cy="256" r="14" fill="{BRAND_CYAN}" filter="url(#glow)"/>
</svg>
'''
with open(f'{BRAND_DIR}/gstpilot-icon.svg', 'w') as f:
    f.write(icon_svg)
print(f"  saved {BRAND_DIR}/gstpilot-icon.svg")

with open(f'{PUBLIC_DIR}/icon.svg', 'w') as f:
    f.write(icon_svg)
print(f"  saved {PUBLIC_DIR}/icon.svg")

# Also update /public/logo.svg (used by some metadata)
logo_svg_simple = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="gBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{BRAND_CYAN}"/>
      <stop offset="100%" stop-color="{BRAND_BLUE}"/>
    </linearGradient>
    <linearGradient id="gPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{BRAND_PURPLE}"/>
      <stop offset="100%" stop-color="#9F67E0"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="#000000"/>
  <circle cx="256" cy="256" r="128" fill="none" stroke="url(#gBlue)" stroke-width="40"
          stroke-dasharray="540 360" stroke-linecap="round" transform="rotate(-90 256 256)"/>
  <path d="M 256 150 L 332 226 L 290 226 L 290 312 L 222 312 L 222 226 L 180 226 Z"
        fill="url(#gPurple)"/>
  <circle cx="256" cy="256" r="14" fill="{BRAND_CYAN}"/>
</svg>
'''
with open(f'{PUBLIC_DIR}/logo.svg', 'w') as f:
    f.write(logo_svg_simple)
print(f"  saved {PUBLIC_DIR}/logo.svg")

logo_full_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1048 986" width="1048" height="986">
  <defs>
    <linearGradient id="gBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{BRAND_CYAN}"/>
      <stop offset="100%" stop-color="{BRAND_BLUE}"/>
    </linearGradient>
    <linearGradient id="gPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{BRAND_PURPLE}"/>
      <stop offset="100%" stop-color="#9F67E0"/>
    </linearGradient>
    <linearGradient id="gText" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E8E8F0"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1048" height="986" fill="#000000"/>
  <g transform="translate(234, 40) scale(1.0)">
    <circle cx="290" cy="290" r="150" fill="none" stroke="url(#gBlue)" stroke-width="44"
            stroke-dasharray="630 420" stroke-linecap="round" transform="rotate(-90 290 290)"
            filter="url(#glow)"/>
    <path d="M 290 170 L 380 260 L 330 260 L 330 360 L 250 360 L 250 260 L 200 260 Z"
          fill="url(#gPurple)" filter="url(#glow)"/>
    <circle cx="290" cy="290" r="16" fill="{BRAND_CYAN}" filter="url(#glow)"/>
  </g>
  <text x="524" y="760" text-anchor="middle"
        font-family="Poppins, Montserrat, Arial, sans-serif" font-weight="700"
        font-size="118" fill="url(#gText)" letter-spacing="-2">GSTPilot</text>
  <text x="858" y="700" text-anchor="middle"
        font-family="Poppins, Arial, sans-serif" font-weight="600"
        font-size="44" fill="{BRAND_CYAN}">TM</text>
  <text x="524" y="880" text-anchor="middle"
        font-family="Inter, Open Sans, Arial, sans-serif" font-weight="400"
        font-size="46" fill="#B8B8C8" letter-spacing="1.5">The Financial Brain of India</text>
  <text x="940" y="868" text-anchor="middle"
        font-family="Inter, Arial, sans-serif" font-weight="400"
        font-size="26" fill="#8888A0">TM</text>
</svg>
'''
with open(f'{BRAND_DIR}/gstpilot-logo-full.svg', 'w') as f:
    f.write(logo_full_svg)
print(f"  saved {BRAND_DIR}/gstpilot-logo-full.svg")

print("\n" + "=" * 70)
print("[8/8] BRAND ASSET GENERATION COMPLETE")
print("=" * 70)
print("\nBrand colors (sampled from official logo):")
print(f"  Blue:   {BRAND_BLUE}")
print(f"  Purple: {BRAND_PURPLE}")
print(f"  Cyan:   {BRAND_CYAN}")
print(f"  BG:     #000000")
print(f"  Text:   #FFFFFF")
