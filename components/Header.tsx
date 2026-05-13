import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-black tracking-tight text-white">
          AI<span className="text-orange-400">TLDR</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/archive"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Archive
          </Link>
          <Link
            href="/about"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            About
          </Link>
          <Link
            href="/#subscribe"
            className="text-sm bg-orange-500 hover:bg-orange-400 text-white font-semibold px-4 py-2 rounded-md transition-colors"
          >
            Subscribe free
          </Link>
        </nav>
      </div>
    </header>
  );
}
