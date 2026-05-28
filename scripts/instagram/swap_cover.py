#!/usr/bin/env python3
"""
Swap the hero image for one article and regenerate its cover.

Usage:
    python scripts/instagram/swap_cover.py <date_folder> <article_folder> <alt-1|alt-2|/abs/path.jpg>

Examples:
    python scripts/instagram/swap_cover.py 2026-05-26-images 01_india-gig-workers alt-1
    python scripts/instagram/swap_cover.py 2026-05-26-images 03_umg-tiktok /tmp/better-photo.jpg
"""
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
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    date_folder, article_folder, source_arg = sys.argv[1], sys.argv[2], sys.argv[3]

    article_dir = REPO_ROOT / "downloads" / date_folder / article_folder
    if not article_dir.exists():
        print(f"✗ Article folder not found: {article_dir}")
        sys.exit(1)

    # Resolve source image
    if source_arg == "alt-1":
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

    shutil.copy2(src, hero_path)
    print(f"✓ Replaced hero.jpg with {src.name}")

    # Regenerate cover
    title = _title_from_caption(article_dir / "caption.md", article_folder)
    photo = Image.open(hero_path).convert("RGB")
    cover_path = article_dir / "cover.jpg"
    logo_color, img_mode = generate_cover(photo, title, cover_path)
    print(f"✓ Regenerated cover.jpg ({img_mode}, {logo_color} logo)")
    print(f"  Headline used: {title}")


if __name__ == "__main__":
    main()
