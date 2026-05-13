import Link from "next/link";
import { getAllEditions } from "@/lib/editions";
import EmailSignup from "@/components/EmailSignup";

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
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded-full px-4 py-1.5 text-xs text-cyan-400 font-medium mb-8">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            Free newsletter · Every weekday
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight mb-6">
            The AI news you need,
            <br />
            <span className="text-cyan-400">in 5 minutes</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Stay ahead of the curve. Every weekday we distill the most important
            AI developments, model releases, research breakthroughs, and
            industry moves — so you don&apos;t have to.
          </p>

          {/* Sign up form */}
          <div id="subscribe" className="max-w-lg mx-auto">
            <EmailSignup />
            <p className="text-xs text-zinc-600 mt-3">
              No spam. Unsubscribe anytime. Trusted by 50,000+ readers.
            </p>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-y border-zinc-800 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-center gap-8 text-center">
          {[
            ["50,000+", "Subscribers"],
            ["5 min", "Daily read time"],
            ["100%", "Free forever"],
          ].map(([stat, label]) => (
            <div key={label}>
              <div className="text-2xl font-black text-white">{stat}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest mt-0.5">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent editions */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-bold text-white">Recent Editions</h2>
          <Link
            href="/archive"
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View all &rarr;
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-3">
          {recent.map((edition) => (
            <Link
              key={edition.slug}
              href={`/editions/${edition.slug}`}
              className="group block bg-zinc-900 border border-zinc-800 hover:border-cyan-800 rounded-xl p-6 transition-all hover:bg-zinc-900/80"
            >
              <time className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                {formatDate(edition.date)}
              </time>
              <h3 className="text-base font-bold text-white mt-2 mb-3 leading-snug group-hover:text-cyan-300 transition-colors line-clamp-3">
                {edition.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
                {edition.excerpt}
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-cyan-500 mt-4 font-medium group-hover:gap-2 transition-all">
                Read edition <span>&rarr;</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
