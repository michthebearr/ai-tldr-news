import { getAllEditions, getEditionBySlug } from "@/lib/editions";
import { marked } from "marked";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SubscribeForm from "@/components/SubscribeForm";

export async function generateStaticParams() {
  return getAllEditions().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const edition = getEditionBySlug(slug);
  if (!edition) return {};
  return {
    title: `${edition.title} — AI TLDR`,
    description: edition.excerpt,
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function EditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const edition = getEditionBySlug(slug);
  if (!edition) notFound();

  const html = marked(edition.content) as string;

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-10 pb-10 border-b border-zinc-800">
        <time className="text-xs text-violet-400 uppercase tracking-widest font-semibold">
          {formatDate(edition.date)}
        </time>
        <h1 className="text-3xl sm:text-4xl font-black text-white mt-3 leading-tight">
          {edition.title}
        </h1>
        <p className="text-zinc-400 mt-4 text-lg leading-relaxed">
          {edition.excerpt}
        </p>
      </div>

      {/* Content */}
      <div
        className="prose-dark"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Subscribe CTA */}
      <div className="mt-16 relative bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">
          Enjoyed this edition?
        </p>
        <h2 className="text-xl font-bold text-white mb-2">
          Get the next one in your inbox.
        </h2>
        <p className="text-zinc-400 text-sm mb-6">
          Free, every weekday. No spam. Unsubscribe anytime.
        </p>
        <SubscribeForm />
      </div>
    </div>
  );
}
