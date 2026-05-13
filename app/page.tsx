import Link from "next/link";
import { getAllEditions } from "@/lib/editions";
import SubscribeForm from "@/components/SubscribeForm";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function HomePage() {
  const recent = getAllEditions().slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/20 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/60 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-8">
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
            Free daily newsletter · Every weekday
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] mb-6">
            AI news that actually
            <br />
            <span className="text-orange-400">moves the needle</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Every weekday we cut through the noise and deliver the 6 most
            important AI stories — model releases, breakthroughs, and industry
            moves — in a 5-minute read.
          </p>
        </div>
      </section>

      {/* Subscribe section */}
      <section id="subscribe" className="max-w-2xl mx-auto px-6 pb-20">
        <div className="relative bg-zinc-900/80 border border-zinc-700/60 rounded-2xl p-8 sm:p-10 text-center overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-orange-950/10 to-transparent pointer-events-none rounded-2xl" />

          <div className="relative">
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-3">
              Join 50,000+ readers
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 leading-tight">
              Stay ahead of the AI curve.
            </h2>
            <SubscribeForm />

            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Free forever
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Unsubscribe anytime
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                5 min read
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent editions */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-white">Recent Editions</h2>
            <p className="text-sm text-zinc-500 mt-1">See what you&apos;ll be getting</p>
          </div>
          <Link
            href="/archive"
            className="text-sm text-orange-400 hover:text-orange-300 transition-colors font-medium"
          >
            View all &rarr;
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
          {recent.map((edition) => (
            <Link
              key={edition.slug}
              href={`/editions/${edition.slug}`}
              className="group block bg-zinc-900/60 border border-zinc-800 hover:border-orange-800/60 rounded-xl p-6 transition-all hover:bg-zinc-900"
            >
              <time className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                {formatDate(edition.date)}
              </time>
              <h3 className="text-base font-bold text-white mt-2 mb-3 leading-snug group-hover:text-orange-300 transition-colors line-clamp-3">
                {edition.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
                {edition.excerpt}
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-orange-500 mt-4 font-medium group-hover:gap-2 transition-all">
                Read edition <span>&rarr;</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
