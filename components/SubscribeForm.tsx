"use client";

import { useState } from "react";

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4 shrink-0"
    >
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  );
}

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json();
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-green-400 font-semibold text-sm">
        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        You&apos;re in! Check your inbox for the next edition.
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          required
          disabled={status === "loading"}
          className="w-full py-[14px] px-5 text-base rounded-xl border border-transparent sm:flex-1 sm:h-11 sm:py-0 sm:px-4 sm:text-sm sm:rounded-lg sm:border-0 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full py-[14px] px-5 text-base rounded-xl sm:w-auto sm:h-11 sm:py-0 sm:px-4 sm:text-sm sm:rounded-lg flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold transition-colors disabled:opacity-60 whitespace-nowrap border border-zinc-700"
        >
          {status === "loading" ? "Subscribing…" : (
            <>
              Subscribe
              <SendIcon />
            </>
          )}
        </button>
      </form>
      {status === "error" && (
        <p className="text-red-400 text-xs mt-2">{errorMsg}</p>
      )}
    </div>
  );
}
