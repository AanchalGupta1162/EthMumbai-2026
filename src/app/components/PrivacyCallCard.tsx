"use client";

import { PrivacyEvent } from "../types";

interface PrivacyCallCardProps {
  event: PrivacyEvent;
  index: number;
}

const ACTION_LABELS: Record<string, { icon: string; label: string }> = {
  wallet_created: { icon: "🔑", label: "Ephemeral wallet created" },
  delay_applied: { icon: "⏱️", label: "Random delay applied" },
  payment_sent: { icon: "💸", label: "x402 payment sent" },
  data_received: { icon: "📦", label: "Data received" },
  wallet_destroyed: { icon: "🗑️", label: "Wallet destroyed" },
};

function truncate(hash: string) {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export default function PrivacyCallCard({
  event,
  index,
}: PrivacyCallCardProps) {
  const explorerUrl = `https://sepolia.basescan.org/tx/${event.txHash}`;

  return (
    <div
      className="glass-card-sm p-4 animate-fade-in-up"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-mono text-muted">
            {truncate(event.walletAddress)}
          </span>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${
            event.status === "complete"
              ? "bg-emerald-400/10 text-emerald-400"
              : "bg-amber-400/10 text-amber-400"
          }`}
        >
          {event.status === "complete" ? "Destroyed" : "Active"}
        </span>
      </div>

      {/* Action steps */}
      <div className="space-y-1.5 mb-3">
        {event.actions.map((a, i) => {
          const info = ACTION_LABELS[a.action] ?? {
            icon: "•",
            label: a.action,
          };
          return (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-zinc-400"
            >
              <span className="text-[11px]">{info.icon}</span>
              <span>{info.label}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
        <span className="text-muted-dark">
          Funded: <span className="text-zinc-300">{event.fundingAmount}</span>
        </span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 transition-colors font-mono"
        >
          {truncate(event.txHash)} ↗
        </a>
      </div>
    </div>
  );
}
