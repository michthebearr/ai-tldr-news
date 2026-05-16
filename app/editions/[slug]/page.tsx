import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllEditions } from "@/lib/editions";
import SubscribeForm from "@/components/SubscribeForm";
import ShareButtons from "./ShareButtons";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Story {
  headline: string;
  summary: string[];
  whyItMatters: string;
  sourceName: string;
  sourceUrl: string;
  image?: string;
}

// ── Content parser ────────────────────────────────────────────────────────────

function parseEditionContent(content: string, storyImages: string[]) {
  const sections = content.trim().split(/\n---\n/);
  const stories: Story[] = [];
  const quickHits: string[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const blocks = trimmed
      .split(/\n\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    const firstBlock = blocks[0] ?? "";

    if (!firstBlock.startsWith("## ")) continue;

    const headline = firstBlock.slice(3).trim();

    if (headline === "Quick Hits") {
      for (const block of blocks.slice(1)) {
        block
          .split("\n")
          .filter((l) => l.startsWith("- "))
          .forEach((l) => quickHits.push(l.slice(2).trim()));
      }
      continue;
    }

    let whyItMatters = "";
    let sourceName = "";
    let sourceUrl = "";
    const summaryParagraphs: string[] = [];

    for (const block of blocks.slice(1)) {
      if (block.startsWith("**Why it matters:**")) {
        whyItMatters = block.replace(/^\*\*Why it matters:\*\*\s*/, "").trim();
      } else if (block.startsWith("**Source:**")) {
        const m = block.match(/\*\*Source:\*\*\s*\[([^\]]+)\]\(([^)]+)\)/);
        if (m) {
          sourceName = m[1];
          sourceUrl = m[2];
        }
      } else {
        summaryParagraphs.push(block);
      }
    }

    stories.push({
      headline,
      summary: summaryParagraphs,
      whyItMatters,
      sourceName,
      sourceUrl,
      image: storyImages[stories.length],
    });
  }

  return { stories, quickHits };
}

// ── Inline link + bold renderer ───────────────────────────────────────────────

function InlineContent({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) {
          return (
            <a
              key={i}
              href={m[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              {m[1]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ── Static params & metadata ──────────────────────────────────────────────────

export function generateStaticParams() {
  return getAllEditions().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const edition = getAllEditions().find((e) => e.slug === slug);
  if (!edition) return {};
  return {
    title: `${edition.title} — AI TLDR`,
    description: edition.excerpt,
    openGraph: edition.coverImage
      ? { images: [{ url: edition.coverImage }] }
      : undefined,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const allEditions = getAllEditions();
  const idx = allEditions.findIndex((e) => e.slug === slug);
  if (idx === -1) notFound();

  const edition = allEditions[idx];
  const prevEdition = allEditions[idx + 1] ?? null; // older
  const nextEdition = allEditions[idx - 1] ?? null; // newer

  const { stories, quickHits } = parseEditionContent(
    edition.content,
    edition.storyImages
  );

  const heroImage = edition.storyImages[0] ?? null;

  return (
    <>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ minHeight: "520px" }}>
        {heroImage ? (
          <Image
            src={heroImage}
            alt={edition.title}
            fill
            unoptimized
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/30 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/20" />

        <div
          className="relative z-10 flex items-end w-full"
          style={{ minHeight: "520px" }}
        >
          <div className="w-full max-w-[720px] mx-auto px-6 pb-14 pt-32">
            <time className="block text-xs text-violet-400 uppercase tracking-widest font-semibold mb-3">
              {formatDate(edition.date)}
            </time>
            <h1
              className="font-black text-white leading-[1.08] mb-4 line-clamp-2"
              style={{ fontSize: "clamp(32px, 5vw, 48px)" }}
            >
              {edition.title}
            </h1>
            <p className="text-zinc-300 text-lg leading-relaxed mb-7 max-w-lg">
              {edition.excerpt}
            </p>
            <a
              href="#subscribe"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Subscribe free →
            </a>
          </div>
        </div>
      </div>

      {/* ── Stories ── */}
      <div className="max-w-[720px] mx-auto px-6 py-14">
        {stories.map((story, i) => (
          <div key={i}>
            {/* Cover image */}
            {story.image && (
              <div
                className="relative w-full rounded-xl overflow-hidden group"
                style={{ height: "280px" }}
              >
                <Image
                  src={story.image}
                  alt={story.headline}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
            )}

            {/* Headline */}
            <h2
              className="font-bold text-white mt-5 mb-4 leading-tight"
              style={{ fontSize: "28px" }}
            >
              {story.headline}
            </h2>

            {/* Summary */}
            {story.summary.map((para, j) => (
              <p
                key={j}
                className="text-zinc-300 mb-4"
                style={{ fontSize: "17px", lineHeight: "1.8" }}
              >
                {para}
              </p>
            ))}

            {/* Why it matters */}
            {story.whyItMatters && (
              <p
                className="mb-5"
                style={{ fontSize: "17px", lineHeight: "1.8" }}
              >
                <strong className="text-violet-400 font-semibold">
                  Why it matters:{" "}
                </strong>
                <span className="text-zinc-300">{story.whyItMatters}</span>
              </p>
            )}

            {/* Source pill */}
            {story.sourceName && story.sourceUrl && (
              <div className="mb-2">
                <a
                  href={story.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-violet-950/60 border border-violet-800/40 text-violet-300 text-sm px-3 py-1.5 rounded-full hover:bg-violet-900/60 transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  {story.sourceName}
                </a>
              </div>
            )}

            {/* Divider */}
            {i < stories.length - 1 && (
              <div className="py-10">
                <hr className="border-zinc-800" />
              </div>
            )}
          </div>
        ))}

        {/* ── Quick Hits ── */}
        {quickHits.length > 0 && (
          <div className="mt-12 pt-10 border-t border-zinc-800">
            <h2
              className="font-bold text-white mb-6"
              style={{ fontSize: "28px" }}
            >
              Quick Hits
            </h2>
            <ul className="space-y-4">
              {quickHits.map((hit, i) => (
                <li
                  key={i}
                  className="flex gap-3"
                  style={{ fontSize: "16px", lineHeight: "1.7" }}
                >
                  <span className="text-violet-500 mt-[3px] shrink-0">→</span>
                  <span className="text-zinc-300">
                    <InlineContent text={hit} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Prev / Next ── */}
        {(prevEdition || nextEdition) && (
          <div className="mt-16 grid grid-cols-2 gap-4">
            <div>
              {prevEdition && (
                <Link
                  href={`/editions/${prevEdition.slug}`}
                  className="group block h-full bg-zinc-900 border border-zinc-800 hover:border-violet-800/60 rounded-xl p-5 transition-all"
                >
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-2">
                    ← Previous
                  </p>
                  <p className="text-sm font-semibold text-white line-clamp-2 group-hover:text-violet-300 transition-colors">
                    {prevEdition.title}
                  </p>
                </Link>
              )}
            </div>
            <div>
              {nextEdition && (
                <Link
                  href={`/editions/${nextEdition.slug}`}
                  className="group block h-full bg-zinc-900 border border-zinc-800 hover:border-violet-800/60 rounded-xl p-5 transition-all text-right"
                >
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-2">
                    Next →
                  </p>
                  <p className="text-sm font-semibold text-white line-clamp-2 group-hover:text-violet-300 transition-colors">
                    {nextEdition.title}
                  </p>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Subscribe box ── */}
        <div
          id="subscribe"
          className="mt-16 relative bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-8 sm:p-10 text-center overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/10 to-transparent pointer-events-none rounded-2xl" />
          <div className="relative">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">
              AI TLDR
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-white mb-4 leading-tight">
              Get AI Daily in your inbox every morning — free
            </h2>
            <SubscribeForm />
            <div className="flex items-center justify-center gap-4 mt-5 text-xs text-zinc-500">
              <span>Free forever</span>
              <span>·</span>
              <span>Unsubscribe anytime</span>
              <span>·</span>
              <span>5 min read</span>
            </div>
          </div>
        </div>

        {/* ── Share ── */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="text-sm text-zinc-500">Share this edition:</span>
          <ShareButtons title={edition.title} />
        </div>
      </div>
    </>
  );
}
