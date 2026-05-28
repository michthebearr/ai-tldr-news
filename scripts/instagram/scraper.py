"""Scrape an aidaily.now edition page and return structured article data."""
import json
import re

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; aidaily-instagram-bot/1.0)"}
TIMEOUT = 15

SKIP_TITLES = {
    "quick hits",
    "get ai daily in your inbox every morning — free",
    "get ai daily in your inbox",
}


def fetch_html(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    return r.text


def slug_from_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:50]


def extract_image_credit(source_url: str, source_pub: str) -> str:
    """Try to find the photo credit on the source article page."""
    try:
        html = fetch_html(source_url)

        # JSON-LD credit fields
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
            try:
                data = json.loads(block)
                credit = (
                    data.get("creditText")
                    or (data.get("copyrightHolder") or {}).get("name")
                    or (data.get("image") or {}).get("creditText")
                )
                if credit:
                    return credit.strip()
            except Exception:
                pass

        # Common inline credit patterns
        patterns = [
            r'Photo by ([^<\n"(]{4,80}?)(?:\)|"|\n|<)',
            r'"credit":\s*"([^"]{4,80})"',
            r'creditText":\s*"([^"]{4,80})"',
            r'Image credit[:\s]+([^<\n]{4,80})',
        ]
        for pat in patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                credit = re.sub(r"<[^>]+>", "", m.group(1)).strip()
                if credit:
                    return credit

        # Named agencies anywhere in the page
        for agency in ("Getty Images", "Reuters", "AP Photo", "AFP", "NurPhoto"):
            if agency.lower() in html.lower():
                return agency

    except Exception:
        pass

    return source_pub


def _collect_article_content(h2: Tag):
    """Walk siblings after an h2, collecting summary paragraphs and the source link."""
    summary_parts = []
    source_url = None
    source_pub = None

    for sib in h2.next_siblings:
        if isinstance(sib, NavigableString):
            continue
        name = getattr(sib, "name", None)

        # Stop at next article heading
        if name == "h2":
            break

        # Stop at separator div (wraps an <hr>)
        if name == "div" and sib.find("hr"):
            break

        if name == "p":
            text = sib.get_text(strip=True)
            if text:
                summary_parts.append(text)

        elif name == "div":
            # Source pill: a div whose only meaningful content is an <a> to an external URL
            link = sib.find("a")
            if link and link.get("href", "").startswith("http"):
                source_url = link["href"].strip()
                source_pub = link.get_text(strip=True)

    summary = " ".join(summary_parts)
    return summary, source_url, source_pub


def scrape_edition(url: str) -> dict:
    """
    Returns:
      {
        "edition_url": str,
        "date": str,
        "articles": [
          { index, title, slug, summary, source_url, source_pub, image_credit },
          ...
        ]
      }
    """
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    articles = []

    for h2 in soup.find_all("h2"):
        title = h2.get_text(strip=True)

        if title.lower() in SKIP_TITLES or "inbox" in title.lower():
            continue

        summary, source_url, source_pub = _collect_article_content(h2)

        if not source_url:
            continue

        articles.append({
            "index": len(articles) + 1,
            "title": title,
            "slug": slug_from_title(title),
            "summary": summary,
            "source_url": source_url,
            "source_pub": source_pub or "Unknown",
            "image_credit": source_pub or "Unknown",
        })

    date_m = re.search(r"/editions/(\d{4}-\d{2}-\d{2})", url)
    date = date_m.group(1) if date_m else "unknown"

    return {"edition_url": url, "date": date, "articles": articles}
