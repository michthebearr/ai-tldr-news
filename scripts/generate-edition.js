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

// ── Config ────────────────────────────────────────────────────────────────────

const FEEDS = [
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://techcrunch.com/feed/",
  "https://www.theverge.com/rss/index.xml",
  "https://feeds.feedburner.com/aiweekly",
  "https://feeds.arstechnica.com/arstechnica/technology-lab",
];

const MODEL = "claude-sonnet-4-6";
const EDITIONS_DIR = path.join(process.cwd(), "content", "editions");
const FROM_ADDRESS = "AI Daily <newsletter@aidaily.now>";

// ── RSS fetching ──────────────────────────────────────────────────────────────

async function fetchArticles() {
  const parser = new RSSParser();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const articles = [];

  for (const feedUrl of FEEDS) {
    try {
      console.log(`Fetching: ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);
      let count = 0;
      for (const item of feed.items) {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : 0;
        if (pubDate >= cutoff) {
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
      console.log(`  → ${count} articles from the last 24 h`);
    } catch (err) {
      console.error(`  ✗ Failed to fetch ${feedUrl}: ${err.message}`);
    }
  }

  return articles;
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

async function generateEdition(articles) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toISOString().slice(0, 10);

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

function saveEdition(text) {
  const start = text.indexOf("---");
  const markdown = start > 0 ? text.slice(start) : text;

  const slugMatch = markdown.match(/^slug:\s*["']?([^"'\n\r]+)["']?/m);
  const today = new Date().toISOString().slice(0, 10);
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

// ── Markdown → HTML email ─────────────────────────────────────────────────────

function applyInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" style="color:#7c3aed;text-decoration:none;font-weight:600;">$1</a>'
    );
}

function buildEmailHtml(markdownText, title, excerpt) {
  const body = markdownText.replace(/^---[\s\S]*?---\n+/, "").trim();
  const blocks = body.split(/\n{2,}/);

  const htmlBlocks = blocks.map((block) => {
    block = block.trim();
    if (!block) return "";

    if (block === "---") {
      return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">';
    }

    if (block.startsWith("## ")) {
      const heading = applyInline(block.slice(3).trim());
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
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

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

  console.log("AI TLDR — Edition Generator\n");

  console.log("Step 1: Fetching RSS feeds...");
  const articles = await fetchArticles();
  console.log(`\nTotal articles found: ${articles.length}`);

  if (articles.length === 0) {
    console.warn("No articles found in the last 24 hours. Exiting.");
    process.exit(0);
  }

  console.log("\nStep 2: Generating newsletter with Claude...");
  const text = await generateEdition(articles);

  console.log("\nStep 3: Saving edition...");
  const filepath = saveEdition(text);
  console.log(`\n✓ Saved: ${filepath}`);

  console.log("\nStep 4: Sending email via Resend...");
  const fm = parseFrontmatter(text);
  const html = buildEmailHtml(text, fm.title || "AI TLDR", fm.excerpt || "");
  await sendEditionEmail(fm.title || "AI TLDR", html);
}

main().catch((err) => {
  console.error("\nFatal error:", err.message || err);
  process.exit(1);
});
