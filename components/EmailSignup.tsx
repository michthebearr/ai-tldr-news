"use client";

import { useState } from "react";

export default function EmailSignup({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center py-2">
        <p className="text-cyan-400 font-semibold">
          You&apos;re in. Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "flex gap-2" : "flex flex-col sm:flex-row gap-3"}>
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
      />
      <button
        type="submit"
        className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold px-6 py-3 rounded-md text-sm transition-colors whitespace-nowrap"
      >
        Get the newsletter
      </button>
    </form>
  );
}
