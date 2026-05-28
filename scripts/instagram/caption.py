"""Draft Instagram captions — Claude API with template fallback."""
import os
import re


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pick_emoji(title: str) -> str:
    t = title.lower()
    if any(w in t for w in ["robot", "autonomous", "humanoid", "physical ai"]):
        return "🤖"
    if any(w in t for w in ["hack", "breach", "cyber", "security", "ransomware"]):
        return "🔐"
    if any(w in t for w in ["health", "medical", "hospital", "patient", "drug"]):
        return "🏥"
    if any(w in t for w in ["fund", "invest", "raise", "million", "billion", "ipo"]):
        return "💰"
    if any(w in t for w in ["music", "spotify", "audio", "song", "podcast"]):
        return "🎵"
    if any(w in t for w in ["car", "ev", "vehicle", "ferrari", "drive", "electric"]):
        return "🏎️"
    if any(w in t for w in ["tiktok", "instagram", "social media", "video"]):
        return "📱"
    if any(w in t for w in ["openai", "gpt", "claude", "gemini", "llm", "language model"]):
        return "🧠"
    return "💡"


_STOP = {
    "the","a","an","is","are","was","were","for","and","or","but","to","of","in",
    "on","at","by","with","from","into","about","over","after","how","why","what",
    "who","when","where","will","can","has","have","had","not","just","its","this",
    "that","they","their","also","all","one","two","new","more","than","first",
}

def _story_hashtags(title: str) -> list[str]:
    words = re.sub(r"[^a-z0-9 ]", "", title.lower()).split()
    return [f"#{w.capitalize()}" for w in words if w not in _STOP and len(w) > 3][:4]


def _build_hashtags(title: str) -> str:
    tags = ["#AI", "#AINews"] + _story_hashtags(title) + ["#Tech", "#Technology", "#AIDaily"]
    return " ".join(dict.fromkeys(tags))


# ── Template fallback ─────────────────────────────────────────────────────────

def _template_caption(article: dict) -> str:
    title = article["title"]
    summary = article.get("summary", title)
    source = article.get("source_pub", "Unknown")
    image_credit = article.get("image_credit", source)
    emoji = _pick_emoji(title)
    hashtags = _build_hashtags(title)

    sentences = re.split(r"(?<=[.!?])\s+", summary.strip())
    mid = max(1, len(sentences) // 2)
    para1 = " ".join(sentences[:mid])
    para2 = " ".join(sentences[mid:])

    lines = [f"{emoji} {title}."]
    lines.append("")
    if para1:
        lines.append(para1)
    if para2:
        lines.append("")
        lines.append(para2)
    lines.append("")
    lines.append(f"Source: {source}")
    lines.append(f"Image: {image_credit}")
    lines.append("Full breakdown in today's edition → link in bio 🔗")
    lines.append("")
    lines.append(hashtags)
    return "\n".join(lines)


# ── Claude caption ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You write Instagram captions for an AI news account called AI Daily.
Your tone is sharp, conversational, and direct — like a smart friend explaining a big tech story.
You follow the exact format the user specifies, no deviations."""

CAPTION_TEMPLATE = """\
Write an Instagram caption for this AI news story. Match this format EXACTLY:

EXAMPLE POST:
🏎️ Ferrari's first EV was designed by Jony Ive — and the early verdict is brutal.

The Luce, Ferrari's first all-electric vehicle, was unveiled this week. It's the highest-profile test yet of whether Ive's post-Apple design language can transfer to a brand with DNA as strong as Ferrari's.

Early reaction: it doesn't.

Critics are calling out that the car looks targeted at regulatory compliance and the Chinese market — not Ferrari's enthusiast base. A luxury brand famous for visceral combustion engines may have picked exactly the wrong designer to reimagine its identity.

Beautiful object. Wrong badge.

Source: The Verge
Image: Getty Images
Full breakdown in today's edition → link in bio 🔗

#AI #AINews #Ferrari #JonyIve #EV #ElectricVehicles #CarDesign #Tech #FerrariLuce #AIDaily

---

NOW WRITE FOR THIS STORY:
Title: {title}
Summary: {summary}
Source publication: {source}
Image credit: {image_credit}
Emoji to open with: {emoji}

RULES (follow exactly):
1. Line 1: {emoji} + one punchy hook sentence — what appears above the "...more" fold.
2. Blank line.
3. 2–3 paragraphs unpacking the story. Conversational. Occasional one-liner paragraph for rhythm.
4. Blank line.
5. Exactly these three lines, verbatim format:
   Source: {source}
   Image: {image_credit}
   Full breakdown in today's edition → link in bio 🔗
6. Blank line.
7. ~10 hashtags. Mix broad (#AI #AINews) and story-specific. Always end with #AIDaily.

Output only the caption — no preamble, no commentary."""


def _claude_caption(article: dict, api_key: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    title = article["title"]
    source = article.get("source_pub", "Unknown")
    image_credit = article.get("image_credit", source)
    emoji = _pick_emoji(title)

    prompt = CAPTION_TEMPLATE.format(
        title=title,
        summary=article.get("summary", title),
        source=source,
        image_credit=image_credit,
        emoji=emoji,
    )

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=700,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


# ── Public API ────────────────────────────────────────────────────────────────

def generate_caption(article: dict) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            return _claude_caption(article, api_key)
        except Exception as e:
            print(f"    ⚠  Claude API failed ({e}), using template")
    return _template_caption(article)
