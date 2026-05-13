#!/usr/bin/env node
"use strict";

const Anthropic = require("@anthropic-ai/sdk");
const RSSParser = require("rss-parser");
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
  "https://www.theverge.com/rss/index.xml",
  "https://venturebeat.com/ai/feed/",
  "https://feeds.arstechnica.com/arstechnica/technology-lab",
];

const MODEL = "claude-sonnet-4-20250514";
const EDITIONS_DIR = path.join(process.cwd(), "content", "editions");

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
  // Strip any preamble before the opening ---
  const start = text.indexOf("---");
  const markdown = start > 0 ? text.slice(start) : text;

  // Extract the slug from frontmatter to use as the filename
  const slugMatch = markdown.match(/^slug:\s*["']?([^"'\n\r]+)["']?/m);
  const today = new Date().toISOString().slice(0, 10);
  const slug = slugMatch ? slugMatch[1].trim() : today;

  fs.mkdirSync(EDITIONS_DIR, { recursive: true });

  const filename = `${slug}.md`;
  const filepath = path.join(EDITIONS_DIR, filename);
  fs.writeFileSync(filepath, markdown.trimEnd() + "\n", "utf-8");

  return filepath;
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
}

main().catch((err) => {
  console.error("\nFatal error:", err.message || err);
  process.exit(1);
});
