"use client";

export default function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        {/* Logo icon */}
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-950"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Ghost<span className="gradient-text">Fare</span>
          </h1>
          <p className="text-xs text-muted-dark -mt-0.5">
            Privacy-first autonomous travel
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-dark">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
        <span>Base Sepolia</span>
      </div>
    </header>
  );
}
