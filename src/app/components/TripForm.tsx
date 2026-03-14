"use client";

import { TripConfig } from "../types";

interface TripFormProps {
  config: TripConfig;
  onChange: (config: TripConfig) => void;
  onStart: () => void;
  disabled: boolean;
}

const AIRPORTS = [
  { code: "BOM", label: "Mumbai (BOM)" },
  { code: "BLR", label: "Bengaluru (BLR)" },
  { code: "DEL", label: "Delhi (DEL)" },
  { code: "HYD", label: "Hyderabad (HYD)" },
  { code: "MAA", label: "Chennai (MAA)" },
  { code: "CCU", label: "Kolkata (CCU)" },
  { code: "GOI", label: "Goa (GOI)" },
];

export default function TripForm({
  config,
  onChange,
  onStart,
  disabled,
}: TripFormProps) {
  const update = (partial: Partial<TripConfig>) =>
    onChange({ ...config, ...partial });

  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      {/* Section title */}
      <div>
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-dark">
          Trip Preferences
        </h2>
      </div>

      {/* From / To row */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-dark font-medium">From</span>
          <select
            value={config.from}
            onChange={(e) => update({ from: e.target.value })}
            disabled={disabled}
            className="bg-surface border border-white/5 rounded-lg px-3 py-2.5 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50 transition-colors"
          >
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-dark font-medium">To</span>
          <select
            value={config.to}
            onChange={(e) => update({ to: e.target.value })}
            disabled={disabled}
            className="bg-surface border border-white/5 rounded-lg px-3 py-2.5 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50 transition-colors"
          >
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Max fare */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-dark font-medium">
          Max fare (₹)
        </span>
        <input
          type="number"
          value={config.maxFare}
          onChange={(e) => update({ maxFare: Number(e.target.value) })}
          disabled={disabled}
          placeholder="4500"
          className="bg-surface border border-white/5 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50 transition-colors"
        />
      </label>

      {/* Budget */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-dark font-medium">
          Total budget (ETH)
        </span>
        <input
          type="number"
          step="0.001"
          value={config.budget}
          onChange={(e) => update({ budget: Number(e.target.value) })}
          disabled={disabled}
          placeholder="0.01"
          className="bg-surface border border-white/5 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50 transition-colors"
        />
      </label>

      {/* Auto-book toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Auto-book</p>
          <p className="text-xs text-muted-dark">
            Book automatically when fare drops
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.autoBook}
          onClick={() => update({ autoBook: !config.autoBook })}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
            config.autoBook ? "bg-emerald-400" : "bg-zinc-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              config.autoBook ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        disabled={disabled}
        className="gradient-btn w-full mt-2 py-3 rounded-xl text-sm font-semibold text-zinc-950 tracking-wide"
      >
        {disabled ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Agent Running…
          </span>
        ) : (
          "Start Private Agent"
        )}
      </button>
    </div>
  );
}
