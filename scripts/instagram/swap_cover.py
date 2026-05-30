#!/usr/bin/env python3
"""
Swap the hero image for one article and regenerate its cover.

Usage:
    python scripts/instagram/swap_cover.py <date_folder> <article_folder> <alt-1|alt-2|/abs/path.jpg>

Examples:
    python scripts/instagram/swap_cover.py 2026-05-26-images 01_india-gig-workers alt-1
    python scripts/instagram/swap_cover.py 2026-05-26-images 03_umg-tiktok /tmp/better-photo.jpg
"""
import argparse
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from image_utils import generate_cover
from PIL import Image

REPO_ROOT = (Path(__file__).parent / ".." / "..").resolve()


def _title_from_caption(caption_path: Path, folder_name: str) -> str:
    """Extract a usable headline from caption.md or fall back to the folder name."""
    if caption_path.exists():
        first_line = caption_path.read_text(encoding="utf-8").split("\n")[0].strip()
        # Strip leading emoji(s)
        clean = re.sub(r"^[\U00010000-\U0010ffff☀-⛿✀-➿\s]+", "", first_line)
        clean = clean.rstrip(".")
        if len(clean) > 10:
            return clean
    # Fallback: humanise the folder name (strip leading "01_", replace dashes)
    slug = re.sub(r"^\d+_", "", folder_name)
    return slug.replace("-", " ").title()


def main() -> None:
    parser = argparse.ArgumentParser(description="Swap hero image and regenerate cover")
    parser.add_argument("date_folder", help="e.g. 2026-05-30-images")
    parser.add_argument("article_folder", help="e.g. 02_google-s-gemini-spark-...")
    parser.add_argument("source", help="alt-1, alt-2, or absolute path to image")
    parser.add_argument(
        "--focus", metavar="X,Y",
        help="Manual crop center as percentages 0-100. Y defaults to 40 if omitted.",
    )
    args = parser.parse_args()

    date_folder, article_folder, source_arg = args.date_folder, args.article_folder, args.source

    focus = None
    if args.focus:
        parts = args.focus.split(",")
        try:
            if len(parts) == 1:
                focus = (float(parts[0]), 40.0)
            elif len(parts) == 2:
                focus = (float(parts[0]), float(parts[1]))
            else:
                raise ValueError
        except ValueError:
            print("✗ --focus must be X or X,Y (e.g. --focus 70 or --focus 70,40)")
            sys.exit(1)

    article_dir = REPO_ROOT / "downloads" / date_folder / article_folder
    if not article_dir.exists():
        print(f"✗ Article folder not found: {article_dir}")
        sys.exit(1)

    # Resolve source image
    if source_arg == "hero":
        src = article_dir / "hero.jpg"
    elif source_arg == "alt-1":
        src = article_dir / "alt-1.jpg"
    elif source_arg == "alt-2":
        src = article_dir / "alt-2.jpg"
    else:
        src = Path(source_arg)

    if not src.exists():
        print(f"✗ Source image not found: {src}")
        sys.exit(1)

    hero_path = article_dir / "hero.jpg"
    backup_path = article_dir / "hero.original.jpg"

    # Back up current hero (once only)
    if hero_path.exists() and not backup_path.exists():
        shutil.copy2(hero_path, backup_path)
        print(f"✓ Backed up hero.jpg → hero.original.jpg")

    if src.resolve() != hero_path.resolve():
        shutil.copy2(src, hero_path)
        print(f"✓ Replaced hero.jpg with {src.name}")
    else:
        print(f"✓ Using existing hero.jpg")

    # Regenerate cover
    title = _title_from_caption(article_dir / "caption.md", article_folder)
    photo = Image.open(hero_path).convert("RGB")
    cover_path = article_dir / "cover.jpg"
    logo_color, img_mode = generate_cover(photo, title, cover_path, focus=focus)
    print(f"✓ Regenerated cover.jpg ({img_mode}, {logo_color} logo)")
    print(f"  Headline used: {title}")


if __name__ == "__main__":
    main()
