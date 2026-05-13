import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">
          &copy; {new Date().getFullYear()} AI TLDR. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
          <Link
            href="/archive"
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            Archive
          </Link>
          <Link
            href="/about"
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            About
          </Link>
        </nav>
      </div>
    </footer>
  );
}
