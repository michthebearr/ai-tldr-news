#!/usr/bin/env python3
"""
Generate Instagram covers + captions for an AI Daily edition.

Usage:
    python scripts/instagram/generate.py --url <edition_url>
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Make sibling modules importable regardless of cwd
sys.path.insert(0, str(Path(__file__).parent))

from caption import generate_caption
from image_utils import ensure_font, generate_cover, save_candidates
from scraper import extract_image_credit, scrape_edition

REPO_ROOT = (Path(__file__).parent / ".." / "..").resolve()


def _article_folder_name(index: int, slug: str) -> str:
    return f"{index:02d}_{slug}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Instagram posts for an AI Daily edition")
    parser.add_argument("--url", required=True, help="Full edition URL")
    parser.add_argument("--output-suffix", default="", help="Suffix appended to the output folder name (e.g. '-test')")
    args = parser.parse_args()

    edition_url = args.url.rstrip("/")

    print("\n📸  AI Daily — Instagram Post Generator")
    print(f"    Edition: {edition_url}\n")

    # Ensure Work Sans Bold is available
    ensure_font()

    # ── Step 1: Scrape ────────────────────────────────────────────────────────
    print("Step 1: Scraping edition page...")
    data = scrape_edition(edition_url)
    articles = data["articles"]
    edition_date = data["date"]
    print(f"  → {len(articles)} article(s) parsed\n")

    if not articles:
        print("✗ No articles found. Check the edition URL and page structure.")
        sys.exit(1)

    # Output root: downloads/YYYY-MM-DD-images{suffix}/
    out_root = REPO_ROOT / "downloads" / f"{edition_date}-images{args.output_suffix}"
    out_root.mkdir(parents=True, exist_ok=True)

    manifest_articles = []

    for article in articles:
        idx = article["index"]
        slug = article["slug"]
        title = article["title"]
        source_url = article["source_url"]
        source_pub = article["source_pub"]

        folder_name = _article_folder_name(idx, slug)
        article_dir = out_root / folder_name
        article_dir.mkdir(exist_ok=True)

        print(f"[{idx}/{len(articles)}] {title}")

        # ── Step 2: Download hero images ──────────────────────────────────────
        print(f"  Fetching images from {source_url[:70]}...")
        hero, img_source = save_candidates(source_url, article_dir)

        # ── Step 3: Generate cover ────────────────────────────────────────────
        cover_path = article_dir / "cover.jpg"
        logo_color = "n/a"
        img_mode = "n/a"

        if hero is not None:
            try:
                logo_color, img_mode = generate_cover(hero, title, cover_path)
                size_kb = cover_path.stat().st_size // 1024
                print(f"  ✓ cover.jpg — {img_mode}, {logo_color} logo, {size_kb}KB")
            except Exception as e:
                print(f"  ✗ Cover generation failed: {e}")
        else:
            print(f"  ✗ No hero image — cover skipped")

        # ── Enrich image credit ───────────────────────────────────────────────
        image_credit = extract_image_credit(source_url, source_pub)
        article["image_credit"] = image_credit

        # ── Step 4: Draft caption ─────────────────────────────────────────────
        print(f"  Drafting caption...")
        caption_text = generate_caption(article)
        caption_path = article_dir / "caption.md"
        caption_path.write_text(caption_text, encoding="utf-8")
        print(f"  ✓ caption.md")

        print()

        # Collect manifest entry
        def rel(p: Path) -> Optional[str]:
            return str(p.relative_to(REPO_ROOT)) if p.exists() else None

        manifest_articles.append({
            "index": idx,
            "folder": folder_name,
            "slug": slug,
            "title": title,
            "url": source_url,
            "source": source_pub,
            "image_credit": image_credit,
            "image_source": img_source,
            "logo_color": logo_color,
            "cover_mode": img_mode,
            "files": {
                "hero":    rel(article_dir / "hero.jpg"),
                "alt_1":   rel(article_dir / "alt-1.jpg"),
                "alt_2":   rel(article_dir / "alt-2.jpg"),
                "cover":   rel(cover_path),
                "caption": str(caption_path.relative_to(REPO_ROOT)),
            },
        })

    # ── Step 5: Write manifest ────────────────────────────────────────────────
    manifest = {
        "date": edition_date,
        "edition_url": edition_url,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "articles": manifest_articles,
    }
    manifest_path = out_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"✅  Done")
    print(f"    Manifest: {manifest_path.relative_to(REPO_ROOT)}")
    print(f"    Output:   {out_root.relative_to(REPO_ROOT)}\n")


# Optional type alias used inside main
from typing import Optional  # noqa: E402

if __name__ == "__main__":
    main()
