"""Image downloading and Instagram cover generation."""
import io
import re
from pathlib import Path
from typing import Optional, Tuple

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; aidaily-instagram-bot/1.0)"}
TIMEOUT = 15

CANVAS_W, CANVAS_H = 1080, 1350
MIN_IMG_W, MIN_IMG_H = 600, 300

_HERE = Path(__file__).parent
REPO_ROOT = (_HERE / ".." / "..").resolve()
FONT_PATH = REPO_ROOT / "assets" / "fonts" / "WorkSans-Bold.ttf"
LOGO_PATH = REPO_ROOT / "assets" / "logo.png"


# ── Font ──────────────────────────────────────────────────────────────────────

def ensure_font() -> None:
    if FONT_PATH.exists():
        return
    FONT_PATH.parent.mkdir(parents=True, exist_ok=True)
    print("  Downloading Work Sans Bold...")
    url = "https://fonts.gstatic.com/s/worksans/v24/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K67QNig.ttf"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    FONT_PATH.write_bytes(r.content)
    print(f"  ✓ Font saved to {FONT_PATH}")


def load_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size)


# ── Image downloading ─────────────────────────────────────────────────────────

def _fetch_bytes(url: str) -> bytes:
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    return r.content


def _extract_candidates(source_url: str) -> list[Tuple[str, str]]:
    """Return [(label, url), ...] in priority order from a source article page."""
    try:
        html = _fetch_bytes(source_url).decode("utf-8", errors="replace")
        soup = BeautifulSoup(html, "html.parser")
        candidates = []

        # og:image
        og = soup.find("meta", property="og:image") or \
             soup.find("meta", attrs={"name": "og:image"})
        if og and og.get("content"):
            candidates.append(("og:image", og["content"].replace("&amp;", "&")))

        # twitter:image
        tw = soup.find("meta", attrs={"name": "twitter:image"}) or \
             soup.find("meta", attrs={"property": "twitter:image"})
        if tw and tw.get("content"):
            candidates.append(("twitter:image", tw["content"].replace("&amp;", "&")))

        # first <figure><img>
        fig = soup.find("figure")
        if fig:
            img = fig.find("img")
            if img:
                src = img.get("src") or img.get("data-src", "")
                if src:
                    candidates.append(("figure", src))

        # first <img> with width >= 600
        for img in soup.find_all("img"):
            try:
                if int(img.get("width", 0)) >= 600:
                    src = img.get("src") or img.get("data-src", "")
                    if src:
                        candidates.append(("img-wide", src))
                        break
            except (ValueError, TypeError):
                pass

        return candidates

    except Exception as e:
        print(f"    ✗ Could not fetch article page: {e}")
        return []


def _download_image(url: str) -> Optional[Image.Image]:
    try:
        data = _fetch_bytes(url)
        img = Image.open(io.BytesIO(data)).convert("RGB")
        if img.width < MIN_IMG_W or img.height < MIN_IMG_H:
            return None
        return img
    except Exception:
        return None


def save_candidates(source_url: str, out_dir: Path) -> Tuple[Optional[Image.Image], str]:
    """
    Download up to 3 candidate images, save as hero.jpg / alt-1.jpg / alt-2.jpg.
    Returns (hero_pil_image, source_label).
    """
    candidates = _extract_candidates(source_url)
    names = ["hero.jpg", "alt-1.jpg", "alt-2.jpg"]
    saved = []
    hero: Optional[Image.Image] = None
    hero_source = "none"

    for label, url in candidates:
        if len(saved) >= 3:
            break
        img = _download_image(url)
        if img is None:
            print(f"    ⚠  Skipped {label} (too small or invalid): {url[:80]}")
            continue
        fname = names[len(saved)]
        img.save(out_dir / fname, "JPEG", quality=92)
        print(f"    ✓ {fname} ← {label}: {url[:80]}")
        if not saved:
            hero = img
            hero_source = label
        saved.append(fname)

    if not saved:
        print(f"    ✗ No usable images found — skipping cover for this article")

    return hero, hero_source


# ── Cover generation ──────────────────────────────────────────────────────────

def _mean_brightness(region: Image.Image) -> float:
    gray = region.convert("L")
    px = list(gray.getdata())
    return sum(px) / max(len(px), 1)


def _tinted_logo(logo: Image.Image, color: Tuple[int, int, int]) -> Image.Image:
    """Replace all opaque logo pixels with `color`, preserving alpha."""
    *_, alpha = logo.split()
    colored = Image.new("RGBA", logo.size, (*color, 255))
    colored.putalpha(alpha)
    return colored


def detect_face_center(img: Image.Image) -> Optional[Tuple[int, int, int, int]]:
    """
    Run Haar cascade face detection on a PIL image.
    Returns (cx, cy, fw, fh) of the largest face, or None.
    cx/cy is the face bounding-box center in image pixels.
    """
    import cv2
    import numpy as np

    gray = np.array(img.convert("L"))
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(cascade_path)
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(40, 40),
    )
    if len(faces) == 0:
        return None
    # Pick the largest face by area
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    return (x + w // 2, y + h // 2, w, h)


def _make_bg_cover(photo: Image.Image, y_bias: float = 0.45) -> Tuple[Image.Image, str]:
    """
    Scale photo to fill canvas, then crop.
    Uses face-aware crop if a face is detected; falls back to y_bias center-crop.
    Returns (cropped_image, crop_description).
    """
    tw, th = CANVAS_W, CANVAS_H
    pw, ph = photo.size
    scale = max(tw / pw, th / ph)
    nw, nh = int(pw * scale), int(ph * scale)
    resized = photo.resize((nw, nh), Image.LANCZOS)

    face = detect_face_center(resized)

    if face is not None:
        fcx, fcy, fw, fh = face
        # Eye line ≈ top 30% of bounding box
        eye_y = (fcy - fh // 2) + int(fh * 0.3)
        # Place eye line at 35% from top of canvas
        crop_y = eye_y - int(th * 0.35)
        crop_x = fcx - tw // 2
        # Clamp to image bounds
        crop_x = max(0, min(crop_x, nw - tw))
        crop_y = max(0, min(crop_y, nh - th))
        desc = f"face detected at ({fcx},{fcy}), size {fw}×{fh} — face-aware crop"
    else:
        crop_x = (nw - tw) // 2
        crop_y = max(0, min(int((nh - th) * y_bias), nh - th))
        desc = "no face detected — center crop (y_bias=0.45)"

    return resized.crop((crop_x, crop_y, crop_x + tw, crop_y + th)), desc


def _make_bg_fitwidth(photo: Image.Image, y_bias: float = 0.28) -> Image.Image:
    """Fit-width mode for ultra-wide (>2:1) images."""
    pw, ph = photo.size
    brightness = _mean_brightness(photo.crop((0, 0, min(200, pw), min(200, ph))))
    bg_color = (255, 255, 255) if brightness >= 128 else (0, 0, 0)

    nw, nh = CANVAS_W, int(ph * (CANVAS_W / pw))
    resized = photo.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), bg_color)
    y = max(0, min(int((CANVAS_H - nh) * y_bias), CANVAS_H - nh))
    canvas.paste(resized, (0, y))
    return canvas


def _add_gradient(canvas: Image.Image) -> Image.Image:
    """Vertical black gradient from y=720, t^1.5 easing to alpha=235 at bottom."""
    grad = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(grad)
    grad_start = 720
    span = CANVAS_H - grad_start
    for y in range(grad_start, CANVAS_H):
        t = (y - grad_start) / span
        alpha = int(235 * (t ** 1.5))
        draw.line([(0, y), (CANVAS_W - 1, y)], fill=(0, 0, 0, alpha))
    return Image.alpha_composite(canvas.convert("RGBA"), grad).convert("RGB")


def _add_logo(canvas: Image.Image) -> Tuple[Image.Image, str]:
    """Place logo at (52, 50), auto-color based on top-left brightness."""
    logo = Image.open(LOGO_PATH).convert("RGBA")

    # Resize to 68px tall, maintain aspect
    target_h = 68
    logo = logo.resize(
        (int(logo.width * target_h / logo.height), target_h),
        Image.LANCZOS,
    )

    # Decide color from top-left 200×200 of canvas
    brightness = _mean_brightness(canvas.crop((0, 0, 200, 200)))
    if brightness < 128:
        logo_rgb = (255, 255, 255)
        shadow_rgb = (0, 0, 0)
        color_name = "white"
    else:
        logo_rgb = (0, 0, 0)
        shadow_rgb = (255, 255, 255)
        color_name = "black"

    # Build shadow layer: tint → offset → blur → scale opacity
    shadow_img = _tinted_logo(logo, shadow_rgb)
    shadow_layer = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    shadow_layer.paste(shadow_img, (52 + 2, 50 + 2), shadow_img)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(5))
    sr, sg, sb, sa = shadow_layer.split()
    sa = sa.point(lambda p: int(p * 160 / 255))
    shadow_layer = Image.merge("RGBA", (sr, sg, sb, sa))

    tinted = _tinted_logo(logo, logo_rgb)

    result = Image.alpha_composite(canvas.convert("RGBA"), shadow_layer)
    result.paste(tinted, (52, 50), tinted)
    return result.convert("RGB"), color_name


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines, current = [], []
    for word in words:
        trial = " ".join(current + [word])
        w = font.getbbox(trial)[2]
        if w <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def _add_text_overlay(canvas: Image.Image, headline: str) -> Image.Image:
    """Draw 'AI  NEWS' tag and auto-sized headline onto canvas."""
    overlay = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Headline layout — try sizes 62→58→54→50→46, pick largest that fits in ≤3 lines
    max_w = CANVAS_W - 120
    chosen_size, chosen_lines = 46, None
    for size in [62, 58, 54, 50, 46]:
        wrapped = _wrap_text(headline, load_font(size), max_w)
        if len(wrapped) <= 3:
            chosen_size, chosen_lines = size, wrapped
            break
    if chosen_lines is None:
        chosen_lines = _wrap_text(headline, load_font(46), max_w)[:3]

    font = load_font(chosen_size)
    line_h = font.getbbox("Ag")[3] + 8
    total_h = len(chosen_lines) * line_h
    headline_top = CANVAS_H - 60 - total_h

    # "AI  NEWS" tag: bottom edge always 24px above the first headline line
    tag_font = load_font(24)
    tag_h = tag_font.getbbox("AI  NEWS")[3]
    tx = 60
    ty = headline_top - 24 - tag_h
    draw.text((tx + 2, ty + 2), "AI  NEWS", font=tag_font, fill=(0, 0, 0, 160))
    draw.text((tx, ty), "AI  NEWS", font=tag_font, fill=(255, 255, 255, 255))

    # Draw headline
    y = headline_top
    for line in chosen_lines:
        draw.text((60 + 2, y + 2), line, font=font, fill=(0, 0, 0, 160))
        draw.text((60, y), line, font=font, fill=(255, 255, 255, 255))
        y += line_h

    return Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")


def generate_cover(
    photo: Image.Image, headline: str, out_path: Path
) -> Tuple[str, str]:
    """
    Build 1080×1350 Instagram cover and save as JPEG.
    Returns (logo_color, image_mode).
    """
    pw, ph = photo.size
    if pw / ph > 2.0:
        bg = _make_bg_fitwidth(photo, y_bias=0.28)
        image_mode = "fit-width"
        print(f"    ultra-wide source — fit-width mode")
    else:
        bg, crop_desc = _make_bg_cover(photo, y_bias=0.45)
        image_mode = "cover-crop"
        print(f"    {crop_desc}")

    bg = _add_gradient(bg)
    bg, logo_color = _add_logo(bg)
    bg = _add_text_overlay(bg, headline)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    bg.save(out_path, "JPEG", quality=92)
    return logo_color, image_mode
