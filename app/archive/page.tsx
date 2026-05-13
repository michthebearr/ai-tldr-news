import Link from "next/link";
import { getAllEditions } from "@/lib/editions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archive — AI TLDR",
  description: "Browse all past editions of the AI TLDR newsletter.",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function ArchivePage() {
  const editions = getAllEditions();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-white mb-3">Archive</h1>
        <p className="text-zinc-400">
          Every edition, newest first. {editions.length} issues and counting.
        </p>
      </div>

      <ul className="space-y-3">
        {editions.map((edition) => (
          <li key={edition.slug}>
            <div className="group flex items-start sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-5 py-4 transition-colors">
              <div className="flex-1 min-w-0">
                <time className="text-xs text-zinc-500 uppercase tracking-widest font-medium block mb-1">
                  {formatDate(edition.date)}
                </time>
                <p className="text-sm font-semibold text-zinc-200 leading-snug line-clamp-2">
                  {edition.title}
                </p>
              </div>
              <Link
                href={`/editions/${edition.slug}`}
                className="shrink-0 text-xs bg-zinc-800 hover:bg-cyan-500 hover:text-zinc-950 text-zinc-300 font-semibold px-4 py-2 rounded-md transition-colors"
              >
                Read
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
