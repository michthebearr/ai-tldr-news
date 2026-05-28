# Build me a daily Instagram post automation for AI Daily News

I run a daily AI newsletter at **aidaily.now**. The codebase is in this repo (`ai-tldr-news`) — a Next.js project. Every weekday a new edition is published at a URL like:

```
https://www.aidaily.now/editions/2026-05-26-india-gig-workers-robots-ai-governance
```

Each edition has 6 articles, each linking to an external source (TechCrunch, The Verge, Bloomberg, etc.).

I want a fully automated daily workflow that turns each edition into 6 ready-to-post Instagram covers + captions. Add it to THIS repo — don't create a new one.

---

## Critical context about my existing repo

- This is a **Next.js / TypeScript** codebase. The Instagram automation should be **pure Python** — do not integrate it into the Next.js build, do not modify `package.json`.
- `scripts/` already exists and contains my edition publishing code. **Do not put new Python files directly in `scripts/`** — create a new folder `scripts/instagram/` for them.
- `downloads/` already exists in the repo root. It contains date folders named `2026-05-25-images/` and `2026-05-26-images/` (with the `-images` suffix). **NEW output must go directly into `downloads/YYYY-MM-DD-images/`** — do NOT nest under any `ai-tldr-news/` or other subfolder.
- `.github/workflows/` may already have workflows. **Do not modify or overwrite any existing workflow.** Create your new workflow as a brand new file at `.github/workflows/generate-instagram.yml`.
- My logo is already at `assets/logo.png` — a black PNG with transparent background, ready to be re-tinted.

**Before writing any code, show me the full file tree you plan to create and confirm none of those files conflict with anything already in the repo.**

---

## What the workflow produces

For every edition, output this structure inside the existing `downloads/` folder:

```
downloads/2026-05-26-images/
├── manifest.json
├── 01_human-archive-india-gig-workers/
│   ├── hero.jpg                    ← downloaded from article's og:image
│   ├── alt-1.jpg                   ← backup option (twitter:image)
│   ├── alt-2.jpg                   ← backup option (first article figure)
│   ├── cover.jpg                   ← finished Instagram post (1080×1350)
│   └── caption.md                  ← Instagram caption draft
├── 02_ai-governance-physical-systems/
│   └── …
└── … (one folder per article)
```

The `downloads/` folder gets committed back to GitHub by the Action — it doubles as an archive.

---

## Cover design specification (lock this exactly)

**Canvas:** 1080 × 1350 pixels (Instagram 4:5 portrait)

**Layout (bottom to top):**

1. **Background:** the article's hero photo, scaled to "cover" (fill the canvas, center-crop). Use `y_bias=0.45` so the subject sits slightly above center.

2. **Logo:** top-left at coordinates `(52, 50)`, **68px tall**.
   - Auto-pick color: sample a 200×200 patch at top-left of the photo. If mean brightness < 128 → use **white logo with soft black drop shadow** (blur 5px, opacity 160/255). If brightness ≥ 128 → use **black logo with soft white drop shadow** (same blur/opacity, swapped colors).
   - The logo file lives at `assets/logo.png`. Treat near-white pixels in the logo PNG as transparent so it can be re-tinted to either color.

3. **Bottom gradient:** vertical black gradient starting at `y=720`, easing with `t^1.5` to alpha 235 at the bottom (`y=1350`). This makes the headline readable on any photo.

4. **"AI  NEWS" tag:** small white text (Work Sans Bold, 24pt), positioned at `(60, H - 310)`. Two spaces between "AI" and "NEWS" — not one — for visual breathing room. No underline.

5. **Headline:** Work Sans Bold, white, left-aligned, anchored 60px from the bottom edge.
   - Auto-shrink: try sizes 62 → 58 → 54 → 50 → 46, pick the largest that fits within `W-120` width and 3 lines max.
   - Add a 2px black drop shadow at offset (+2, +2) with opacity 160/255 for legibility.

**Special cases for ultra-wide source photos:** If the source image's aspect ratio is wider than 2:1, use a "fit-width" mode instead: scale to canvas width, fill top/bottom with a background color (white for light-background sources, black for dark). For these, push the image up slightly (`y_bias=0.28`) so the headline gets a clean lower zone instead of empty whitespace.

---

## Caption format (match my real Instagram posts exactly)

Reference — this is a real post of mine:

```
🏎️ Ferrari's first EV was designed by Jony Ive — and the early verdict is brutal.

The Luce, Ferrari's first all-electric vehicle, was unveiled this week. It's the highest-profile test yet of whether Ive's post-Apple design language can transfer to a brand with DNA as strong as Ferrari's.

Early reaction: it doesn't.

Critics are calling out that the car looks targeted at regulatory compliance and the Chinese market — not Ferrari's enthusiast base. A luxury brand famous for visceral combustion engines may have picked exactly the wrong designer to reimagine its identity.

Beautiful object. Wrong badge.

Source: The Verge
Image: Getty Images
Full breakdown in today's edition → link in bio 🔗

#AI #AINews #Ferrari #JonyIve #EV #ElectricVehicles #CarDesign #Tech #FerrariLuce #AIDaily
```

**Required structure:**

1. **Lead line:** single relevant emoji + one-sentence punchy hook (this is what shows above the "...more" fold)
2. Blank line
3. **2-3 paragraphs** unpacking the story, conversational tone, occasionally a one-line punchy paragraph for rhythm
4. Blank line
5. **Credit block (always three lines, no exceptions):**
   ```
   Source: [Publication name]
   Image: [Image credit — usually Getty Images, Reuters, or the publication name]
   Full breakdown in today's edition → link in bio 🔗
   ```
6. Blank line
7. **Hashtag block:** ~10 tags, mix of broad (#AI #AINews #AIDaily) and story-specific. Always end with #AIDaily.

**Important:** Always include BOTH `Source:` and `Image:` lines, even if they're the same publication. Never skip the Image credit.

If you have access to the Anthropic API (look for `ANTHROPIC_API_KEY` in env), draft the caption with Claude using the article's summary. If not, fall back to a template that combines: a generic emoji + the article title as the hook, the article summary split into paragraphs, then the credits block + hashtags.

---

## Pipeline (run end-to-end on every edition URL)

```
Step 1: Scrape edition page
   → extract 6 articles, each with: title, source URL, source publication, image credit, summary
   → Try in order: sibling .json file, JSON-LD, __NEXT_DATA__, then HTML fallback

Step 2: For each article, download the hero image
   → Fallback chain: og:image → twitter:image → first <figure><img> → first <img width>=600
   → Save 3 candidates (hero.jpg, alt-1.jpg, alt-2.jpg) so I can swap manually later
   → Skip any image smaller than 600×300

Step 3: Generate Instagram cover for each article
   → Apply the cover spec above
   → Auto-detect logo color (white vs black) by sampling top-left
   → Auto-detect ultra-wide source images and use fit-width mode

Step 4: Draft Instagram caption for each article
   → Use Claude API if available, else template
   → Always include Source + Image + link-in-bio credit block
   → Always end with hashtags including #AIDaily

Step 5: Write manifest.json summarizing what was generated
   → Date, edition URL, generated_at timestamp
   → Per-article: index, slug, title, url, source, image_credit, all file paths
```

---

## Tech stack & exact file locations

- **Language:** Python 3.11
- **Libraries:** `requests`, `beautifulsoup4`, `Pillow` (no Selenium/Playwright — the edition page is server-rendered)
- **Fonts:** Work Sans Bold (download from Google Fonts at install time, vendor to `assets/fonts/`)
- **Python scripts location:** `scripts/instagram/` (a NEW subfolder — do NOT put files directly in `scripts/`)
- **Entry point:** `scripts/instagram/generate.py --url <edition_url>`
- **Cover swap utility:** `scripts/instagram/swap_cover.py <date_folder> <article_slug> <alt-1|alt-2|/path/to/photo.jpg>` — replaces hero, backs up original as `hero.original.jpg`, regenerates cover
- **Requirements file:** if `requirements.txt` already exists in the repo root, create `scripts/instagram/requirements.txt` instead. Otherwise put it at the root.

---

## GitHub Actions workflow

Create a brand new file at `.github/workflows/generate-instagram.yml`. **Do not modify any existing workflow file.** I'll wire the trigger from my existing publish workflow separately later.

Two triggers:

1. **`repository_dispatch`** with event type `edition_published` — fired from my existing publishing workflow after a new edition publishes. The payload includes `{"edition_url": "..."}`.

2. **`workflow_dispatch`** — manual run with `edition_url` input, for backfills or re-runs.

Workflow steps:
1. Checkout
2. Setup Python 3.11
3. Install Work Sans Bold font into `assets/fonts/` if not vendored
4. `pip install -r scripts/instagram/requirements.txt` (or root `requirements.txt` if you put it there)
5. Run `python scripts/instagram/generate.py --url $URL` (URL resolved from either trigger source)
6. Commit the resulting `downloads/` changes back to the repo with message `Generate Instagram posts for {date} edition`
7. Push

The runner needs `permissions: { contents: write }` to commit back.

---

## Sanity checks to include

After the first successful run, the script should print:
- Number of articles parsed
- For each: which image source was used (og:image vs twitter:image vs figure), what logo color was picked, the final cover dimensions
- Path to the manifest

If any article has no usable hero image, log it loudly but continue with the rest — don't fail the whole job over one broken image link.

---

## What to ask me before you start

1. Show me the file tree you plan to create. Confirm each file location doesn't conflict with anything already in this repo. Pay extra attention to `scripts/`, `.github/workflows/`, and `requirements.txt`.
2. Check `https://www.aidaily.now/editions/2026-05-26-india-gig-workers-robots-ai-governance` and tell me whether the page has structured data (JSON-LD, a sibling `.json` file, or `__NEXT_DATA__`) — or whether the scraper has to parse loose HTML.
3. Confirm you can see my logo at `assets/logo.png` and that it's a usable black-on-transparent PNG.

Wait for my "go" before writing any code.

---

## What this workflow does NOT do

- Does **not** post to Instagram directly (Instagram's API requires Meta Business approval). The next step is uploading from `downloads/` to Buffer or posting manually.
- Does **not** write headlines. The cover headline must come from my edition page already in final form.

---

After I say "go," build this end-to-end, then run the script against today's edition URL as a smoke test:

```
https://www.aidaily.now/editions/2026-05-26-india-gig-workers-robots-ai-governance
```

and show me one finished cover + caption so I can verify the output matches my Instagram posts.
