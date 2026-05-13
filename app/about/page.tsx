import type { Metadata } from "next";
import SubscribeForm from "@/components/SubscribeForm";

export const metadata: Metadata = {
  title: "About — AI TLDR",
  description:
    "Learn about AI TLDR, the free daily newsletter covering AI news in 5 minutes.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-white mb-4">
          About AI TLDR
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          The AI landscape moves faster than anyone can keep up with alone.
          We fix that.
        </p>
      </div>

      <div className="space-y-10 text-zinc-400 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">What is AI TLDR?</h2>
          <p>
            AI TLDR is a free daily newsletter that distills the most important
            artificial intelligence news into a 5-minute read. We cover model
            releases, research breakthroughs, product launches, funding rounds,
            policy changes, and the technical trends shaping the AI industry —
            every weekday morning.
          </p>
          <p className="mt-3">
            No hype. No fluff. Just the signal you need to stay informed and
            make better decisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">Who is it for?</h2>
          <ul className="space-y-3">
            {[
              "Software engineers and developers building with AI",
              "Founders and product managers integrating AI into their products",
              "Researchers and academics tracking the field",
              "Executives and investors navigating the AI landscape",
              "Anyone who wants to stay sharp without drowning in feeds",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="text-orange-400 mt-1 shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">
            How often does it go out?
          </h2>
          <p>
            Every weekday morning (Monday–Friday). Each edition is carefully
            curated and takes about 5 minutes to read. We don&apos;t publish on
            weekends or major holidays.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">
            What does it cost?
          </h2>
          <p>
            Nothing. AI TLDR is completely free. We believe staying informed
            about AI shouldn&apos;t be a premium perk. We&apos;re supported by
            occasional sponsorships that we clearly label when they appear.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">
            How do I subscribe?
          </h2>
          <p className="mb-6">
            Drop your email below and you&apos;ll get the next edition delivered
            directly to your inbox. We never share your email, and you can
            unsubscribe with one click at any time.
          </p>
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
            <SubscribeForm />
          </div>
        </section>
      </div>
    </div>
  );
}
