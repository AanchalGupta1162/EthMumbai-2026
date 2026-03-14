"use client";

interface StatsBarProps {
  anonymizedCalls: number;
}

export default function StatsBar({ anonymizedCalls }: StatsBarProps) {
  const stats = [
    {
      label: "Identity Leaked",
      value: "0",
      color: "text-emerald-400",
    },
    {
      label: "Real Wallet Used",
      value: "Never",
      color: "text-emerald-400",
    },
    {
      label: "Anonymous Calls",
      value: String(anonymizedCalls),
      color: "text-cyan-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="glass-card-sm px-3 py-3 text-center"
        >
          <p className={`text-lg font-bold font-mono ${s.color}`}>
            {s.value}
          </p>
          <p className="text-[10px] text-muted-dark uppercase tracking-wider mt-0.5">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}
