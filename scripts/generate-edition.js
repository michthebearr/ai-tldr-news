#!/usr/bin/env node
"use strict";

const Anthropic = require("@anthropic-ai/sdk");
const RSSParser = require("rss-parser");
const { Resend } = require("resend");
const fs = require("fs");
const path = require("path");

// Load .env.local if present
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

// ── CLI flags ─────────────────────────────────────────────────────────────────

const dateArgIdx = process.argv.indexOf("--date");
const TARGET_DATE = dateArgIdx !== -1 ? process.argv[dateArgIdx + 1] : null;

if (TARGET_DATE && !/^\d{4}-\d{2}-\d{2}$/.test(TARGET_DATE)) {
  console.error("Error: --date must be in YYYY-MM-DD format (e.g. 2026-05-13)");
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────

const FEEDS = [
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://techcrunch.com/feed/",
  "https://www.theverge.com/rss/index.xml",
  "https://www.artificialintelligence-news.com/feed/",
  "https://syncedreview.com/feed/",
  "https://feeds.arstechnica.com/arstechnica/technology-lab",
];

const MODEL = "claude-sonnet-4-6";
const EDITIONS_DIR = path.join(process.cwd(), "content", "editions");
const FROM_ADDRESS = "AI Daily <newsletter@aidaily.now>";

// ── RSS fetching ──────────────────────────────────────────────────────────────

async function fetchArticles(cutoffStart, cutoffEnd) {
  const parser = new RSSParser();
  const articles = [];

  for (const feedUrl of FEEDS) {
    try {
      console.log(`Fetching: ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);
      let count = 0;
      for (const item of feed.items) {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : 0;
        if (pubDate >= cutoffStart && pubDate < cutoffEnd) {
          articles.push({
            title: (item.title || "").trim(),
            description: (item.contentSnippet || item.summary || item.content || "")
              .replace(/<[^>]+>/g, "")
              .trim()
              .slice(0, 400),
            url: item.link || "",
            source: feed.title || feedUrl,
            pubDate: item.pubDate || "",
          });
          count++;
        }
      }
      console.log(`  → ${count} article(s) in window`);
    } catch (err) {
      console.error(`  ✗ Failed to fetch ${feedUrl}: ${err.message}`);
    }
  }

  return articles;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "and","or","but","for","nor","so","yet","at","by","in","of",
  "on","to","up","as","it","its","this","that","these","those",
  "with","from","into","about","over","after","how","why","what",
  "who","when","where","will","can","has","have","had","not","just",
  "more","new","than","then","their","they","also","all","one","two",
]);

function titleWords(title) {
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
  );
}

function wordOverlap(titleA, titleB) {
  const wordsA = titleWords(titleA);
  const wordsB = titleWords(titleB);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / Math.max(wordsA.size, wordsB.size);
}

function loadRecentEditionData(days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const urls = new Set();
  const headlines = [];

  if (!fs.existsSync(EDITIONS_DIR)) return { urls, headlines };

  for (const file of fs.readdirSync(EDITIONS_DIR)) {
    if (!file.endsWith(".md")) continue;
    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    if (new Date(dateMatch[1] + "T00:00:00Z").getTime() < cutoff) continue;

    const content = fs.readFileSync(path.join(EDITIONS_DIR, file), "utf-8");

    for (const m of content.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) {
      urls.add(m[1].split("?")[0]);
    }
    for (const m of content.matchAll(/^## (.+)$/gm)) {
      const h = m[1].trim();
      if (h !== "Quick Hits") headlines.push(h);
    }
  }

  return { urls, headlines };
}

function deduplicateArticles(articles, { urls, headlines }) {
  const before = articles.length;
  const filtered = articles.filter((article) => {
    if (urls.has(article.url.split("?")[0])) return false;
    for (const h of headlines) {
      if (wordOverlap(article.title, h) > 0.6) return false;
    }
    return true;
  });
  const removed = before - filtered.length;
  if (removed > 0) console.log(`  → Removed ${removed} duplicate(s) seen in the last 7 days`);
  return filtered;
}

// ── Prompt helpers ────────────────────────────────────────────────────────────

function buildArticleList(articles) {
  if (articles.length === 0) {
    return "No articles were found in the last 24 hours from the provided feeds.";
  }
  return articles
    .map(
      (a, i) =>
        `[${i + 1}] SOURCE: ${a.source}\n` +
        `TITLE: ${a.title}\n` +
        `DESC: ${a.description}\n` +
        `URL: ${a.url}\n` +
        `PUBLISHED: ${a.pubDate}`
    )
    .join("\n\n---\n\n");
}

function buildSystemPrompt(today) {
  return `You are the editor of "AI TLDR", a free daily newsletter that delivers the most important AI news in a 5-minute read. Your writing is clear, punchy, opinionated, and insightful — zero fluff.

Your task: read the articles provided and write today's newsletter edition.

Rules:
- Pick exactly 6 stories (or fewer if there aren't 6 distinct AI stories worth covering)
- For each story: write a bold punchy headline, a 2-3 sentence plain-English summary explaining what happened, and a separate **Why it matters:** line with one sentence on its significance
- Also include a "Quick Hits" section at the end with 3-5 one-line bullets covering minor stories
- Do NOT use AI-sounding phrases like "In a significant development", "It's worth noting", "As of my knowledge cutoff"
- Write for a smart technical reader who has 5 minutes, not 50

Output ONLY the complete markdown file in this exact format with no preamble or explanation:

---
title: "Punchy 8-12 word headline summarizing today's top themes"
date: "${today}"
slug: "${today}-short-kebab-case-slug"
excerpt: "One compelling sentence under 180 characters that makes someone want to read."
---

## Story Headline Here

2-3 sentence plain-English summary of what happened.

**Why it matters:** One sentence on the significance.

**Source:** [Publication Name](URL)

---

(repeat the block above for each of the 6 stories)

---

## Quick Hits

- Short bullet for a minor story worth noting, with [link](URL)
- (3-5 bullets total)
`;
}

// ── Claude API call ───────────────────────────────────────────────────────────

async function generateEdition(articles, today) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = buildSystemPrompt(today);
  const articleList = buildArticleList(articles);

  console.log(`\nSending ${articles.length} articles to Claude (${MODEL})...`);
  console.log("Streaming response:\n" + "─".repeat(60));

  let fullText = "";

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Here are today's AI news articles. Write today's newsletter edition.\n\n${articleList}`,
      },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
      fullText += event.delta.text;
    }
  }

  const final = await stream.finalMessage();
  console.log("\n" + "─".repeat(60));
  console.log(
    `\nTokens — input: ${final.usage.input_tokens}, output: ${final.usage.output_tokens}` +
    (final.usage.cache_read_input_tokens
      ? `, cache_read: ${final.usage.cache_read_input_tokens}`
      : "")
  );

  return fullText;
}

// ── Save to disk ──────────────────────────────────────────────────────────────

function saveEdition(text, today) {
  const start = text.indexOf("---");
  const markdown = start > 0 ? text.slice(start) : text;

  const slugMatch = markdown.match(/^slug:\s*["']?([^"'\n\r]+)["']?/m);
  const slug = slugMatch ? slugMatch[1].trim() : today;

  fs.mkdirSync(EDITIONS_DIR, { recursive: true });

  const filename = `${slug}.md`;
  const filepath = path.join(EDITIONS_DIR, filename);
  fs.writeFileSync(filepath, markdown.trimEnd() + "\n", "utf-8");

  return filepath;
}

// ── Frontmatter parser ────────────────────────────────────────────────────────

function parseFrontmatter(text) {
  const result = {};
  const match = text.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return result;
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*["']?(.*?)["']?\s*$/);
    if (kv) result[kv[1]] = kv[2].trim();
  }
  return result;
}

// ── Story image helpers ───────────────────────────────────────────────────────

function isValidImageUrl(url) {
  if (!url || !url.startsWith("https://")) return false;
  const lower = url.toLowerCase();
  return !["logo", "avatar", "icon", "badge", "pixel", "tracking"].some((t) =>
    lower.includes(t)
  );
}

function extractOgImage(html) {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

function extractTwitterImage(html) {
  const m =
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  return m ? m[1] : null;
}

function findLargeImage(html) {
  const imgRegex = /<img\b[^>]+>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    const wMatch = tag.match(/\bwidth=["']?(\d+)/i);
    const hMatch = tag.match(/\bheight=["']?(\d+)/i);
    const w = wMatch ? parseInt(wMatch[1]) : 0;
    const h = hMatch ? parseInt(hMatch[1]) : 0;
    if ((w > 400 || h > 400) && isValidImageUrl(src)) return src;
  }
  return null;
}

function getUnsplashUrl(headline) {
  const lower = headline.toLowerCase();
  if (/\b(ai|llm|gpt|claude|gemini|openai|anthropic|chatgpt|language model|artificial intelligence|machine learning)\b/.test(lower))
    return "https://source.unsplash.com/800x400/?artificial-intelligence,technology";
  if (/\b(robot|robotics|autonomous|drone|humanoid)\b/.test(lower))
    return "https://source.unsplash.com/800x400/?robot,technology";
  if (/\b(cyber|hack|breach|security|ransomware|malware|phishing|vulnerability)\b/.test(lower))
    return "https://source.unsplash.com/800x400/?cybersecurity,technology";
  if (/\b(health|medical|hospital|patient|doctor|clinical|drug|biotech)\b/.test(lower))
    return "https://source.unsplash.com/800x400/?healthcare,technology";
  if (/\b(fund|raise|million|billion|startup|invest|valuation|ipo|acquire|acquisition)\b/.test(lower))
    return "https://source.unsplash.com/800x400/?business,technology";
  return "https://source.unsplash.com/800x400/?technology,innovation";
}

async function fetchCoverImage(url, headline) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; newsletter-bot/1.0)" },
    });
    clearTimeout(timer);

    if (!response.ok) return getUnsplashUrl(headline);

    const html = await response.text();

    const ogImage = extractOgImage(html)?.replace(/&amp;/g, "&");
    if (ogImage && isValidImageUrl(ogImage)) return ogImage;

    const twitterImage = extractTwitterImage(html)?.replace(/&amp;/g, "&");
    if (twitterImage && isValidImageUrl(twitterImage)) return twitterImage;

    const largeImg = findLargeImage(html)?.replace(/&amp;/g, "&");
    if (largeImg) return largeImg;
  } catch {
    // timeout or network error — fall through to Unsplash
  }
  return getUnsplashUrl(headline);
}

async function fetchAllStoryImages(markdownText) {
  const body = markdownText.replace(/^---[\s\S]*?---\n+/, "");
  const sections = body.split(/\n+---\n+/);
  const storyImages = [];

  for (const section of sections) {
    const trimmed = section.trim();
    const headlineMatch = trimmed.match(/^##\s+(.+)/m);
    if (!headlineMatch) continue;
    const headline = headlineMatch[1].trim();
    if (headline === "Quick Hits") continue;

    const urlMatch = trimmed.match(/\*\*Source:\*\*\s*\[[^\]]+\]\(([^)]+)\)/);
    const url = urlMatch ? urlMatch[1] : null;

    console.log(`  Fetching image for: ${headline.slice(0, 60)}`);
    const imageUrl = url
      ? await fetchCoverImage(url, headline)
      : getUnsplashUrl(headline);
    storyImages.push(imageUrl);
  }

  return storyImages;
}

function injectFrontmatterImages(markdownText, storyImages) {
  if (!storyImages.length) return markdownText;
  const imagesYaml = storyImages.map((url) => `  - "${url}"`).join("\n");
  const firstDash = markdownText.indexOf("---\n");
  if (firstDash !== 0) return markdownText;
  const secondDash = markdownText.indexOf("\n---\n", firstDash + 3);
  if (secondDash === -1) return markdownText;
  return (
    markdownText.slice(0, secondDash) +
    `\nstory_images:\n${imagesYaml}` +
    markdownText.slice(secondDash)
  );
}

// ── Markdown → HTML email ─────────────────────────────────────────────────────

function applyInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" style="color:#7c3aed;text-decoration:none;font-weight:600;">$1</a>'
    );
}

function buildEmailHtml(markdownText, title, excerpt, storyImages = []) {
  const body = markdownText.replace(/^---[\s\S]*?---\n+/, "").trim();
  const blocks = body.split(/\n{2,}/);

  // Pre-extract story source URLs in order so images link to the right articles
  const storyUrls = [];
  const sourcePattern = /\*\*Source:\*\*\s*\[[^\]]+\]\(([^)]+)\)/g;
  let sm;
  while ((sm = sourcePattern.exec(body)) !== null) {
    storyUrls.push(sm[1]);
  }

  let storyIndex = 0;

  const htmlBlocks = blocks.map((block) => {
    block = block.trim();
    if (!block) return "";

    if (block === "---") {
      return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">';
    }

    if (block.startsWith("## ")) {
      const headingText = block.slice(3).trim();
      const isQuickHits = headingText === "Quick Hits";
      const heading = applyInline(headingText);

      if (!isQuickHits && storyIndex < storyImages.length) {
        const imgUrl = storyImages[storyIndex];
        const linkUrl = storyUrls[storyIndex] || "#";
        const altText = headingText.replace(/[<>"&]/g, "");
        storyIndex++;
        return (
          `<a href="${linkUrl}" style="display:block;margin:36px 0 0;text-decoration:none;">` +
          `<img src="${imgUrl}" alt="${altText}" style="width:100%;max-height:250px;object-fit:cover;border-radius:8px;display:block;" loading="lazy">` +
          `</a>\n` +
          `<h2 style="font-size:20px;font-weight:800;color:#111827;margin:12px 0 10px;padding-bottom:10px;border-bottom:3px solid #7c3aed;line-height:1.3;">${heading}</h2>`
        );
      }

      if (!isQuickHits) storyIndex++;
      return `<h2 style="font-size:20px;font-weight:800;color:#111827;margin:36px 0 10px;padding-bottom:10px;border-bottom:3px solid #7c3aed;line-height:1.3;">${heading}</h2>`;
    }

    const lines = block.split("\n");
    if (lines.every((l) => l.startsWith("- "))) {
      const items = lines
        .map(
          (l) =>
            `<li style="margin-bottom:8px;color:#374151;line-height:1.6;">${applyInline(l.slice(2).trim())}</li>`
        )
        .join("");
      return `<ul style="padding-left:20px;margin:12px 0;">${items}</ul>`;
    }

    const para = applyInline(block.replace(/\n/g, " "));
    return `<p style="color:#374151;font-size:16px;line-height:1.75;margin:10px 0;">${para}</p>`;
  });

  const inner = htmlBlocks.filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media (max-width:600px) {
    .email-outer { padding-left:0 !important; padding-right:0 !important; }
    .email-card  { padding-left:8px !important; padding-right:8px !important; border-radius:0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div class="email-outer" style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div class="email-card" style="background:#ffffff;border-radius:12px;padding:40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

      <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #e5e7eb;">
        <p style="color:#7c3aed;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 12px;">AI TLDR</p>
        <h1 style="font-size:26px;font-weight:800;color:#111827;margin:0 0 12px;line-height:1.25;">${title}</h1>
        <p style="color:#6b7280;font-size:15px;margin:0;line-height:1.6;">${excerpt}</p>
      </div>

      ${inner}

      <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="color:#9ca3af;font-size:13px;margin:0;">You're receiving this because you subscribed to AI TLDR.</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

// ── Resend email send ─────────────────────────────────────────────────────────

async function getSubscribers(resend) {
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) {
    console.warn("  ⚠ RESEND_AUDIENCE_ID not set — no subscriber list available.");
    return [];
  }

  const { data, error } = await resend.contacts.list({ audienceId });
  if (error) {
    console.error(`  ✗ Failed to fetch contacts: ${JSON.stringify(error)}`);
    return [];
  }

  const contacts = data?.data ?? [];
  const active = contacts.filter((c) => !c.unsubscribed);
  console.log(`  → ${active.length} active subscriber(s) (${contacts.length - active.length} unsubscribed)`);
  return active;
}

async function sendEditionEmail(title, htmlContent) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("\n⚠ RESEND_API_KEY not set — skipping email send.");
    return;
  }

  const resend = new Resend(apiKey);

  const subscribers = await getSubscribers(resend);
  if (subscribers.length === 0) {
    console.warn("  ⚠ No subscribers to send to.");
    return;
  }

  // Resend batch supports up to 100 per request — chunk if needed
  const BATCH_SIZE = 100;
  let totalSent = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const chunk = subscribers.slice(i, i + BATCH_SIZE);
    const messages = chunk.map((contact) => ({
      from: FROM_ADDRESS,
      to: [contact.email],
      subject: title,
      html: htmlContent,
    }));

    const { data, error } = await resend.batch.send(messages);
    if (error) {
      console.error(`  ✗ Batch send failed: ${JSON.stringify(error)}`);
      continue;
    }
    totalSent += data?.data?.length ?? chunk.length;
  }

  console.log(`  ✓ Sent to ${totalSent} subscriber(s) via Resend`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const today = TARGET_DATE ?? new Date().toISOString().slice(0, 10);

  let cutoffStart, cutoffEnd;
  if (TARGET_DATE) {
    cutoffStart = new Date(TARGET_DATE + "T00:00:00Z").getTime();
    cutoffEnd   = cutoffStart + 24 * 60 * 60 * 1000;
    console.log(`AI TLDR — Edition Generator (backfill: ${TARGET_DATE})\n`);
  } else {
    cutoffEnd   = Date.now();
    cutoffStart = cutoffEnd - 24 * 60 * 60 * 1000;
    console.log("AI TLDR — Edition Generator\n");
  }

  console.log("Step 1: Fetching RSS feeds...");
  const rawArticles = await fetchArticles(cutoffStart, cutoffEnd);
  console.log(`\nTotal articles found: ${rawArticles.length}`);

  if (rawArticles.length === 0) {
    console.warn("No articles found in the window. Exiting.");
    process.exit(0);
  }

  console.log("\nStep 1b: Deduplicating against last 7 days...");
  const recentData = loadRecentEditionData(7);
  const articles = deduplicateArticles(rawArticles, recentData);
  console.log(`  → ${articles.length} article(s) remaining after dedup`);

  if (articles.length === 0) {
    console.warn("No new articles after deduplication. Exiting.");
    process.exit(0);
  }

  console.log("\nStep 2: Generating newsletter with Claude...");
  const text = await generateEdition(articles, today);

  console.log("\nStep 3: Saving edition...");
  const filepath = saveEdition(text, today);
  console.log(`\n✓ Saved: ${filepath}`);

  console.log("\nStep 4: Fetching story images...");
  const storyImages = await fetchAllStoryImages(text);
  console.log(`  → ${storyImages.length} story image(s) resolved`);

  if (storyImages.length > 0) {
    const savedText = fs.readFileSync(filepath, "utf-8");
    const updatedText = injectFrontmatterImages(savedText, storyImages);
    fs.writeFileSync(filepath, updatedText, "utf-8");
    console.log("  ✓ Updated frontmatter with story_images");
  }

  if (TARGET_DATE) {
    console.log("\nStep 5: Skipping email send (past date backfill).");
  } else {
    console.log("\nStep 5: Sending email via Resend...");
    const fm = parseFrontmatter(text);
    const html = buildEmailHtml(text, fm.title || "AI TLDR", fm.excerpt || "", storyImages);
    await sendEditionEmail(fm.title || "AI TLDR", html);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err.message || err);
  process.exit(1);
});
