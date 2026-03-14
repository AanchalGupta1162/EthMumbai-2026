"use client";

import { PrivacyEvent } from "../types";
import StatsBar from "./StatsBar";
import PrivacyCallCard from "./PrivacyCallCard";

interface PrivacyPanelProps {
  events: PrivacyEvent[];
}

export default function PrivacyPanel({ events }: PrivacyPanelProps) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4 h-full">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-dark">
          Privacy Layer
        </h2>
        <p className="text-xs text-zinc-600 mt-0.5">
          Every API call uses a fresh wallet
        </p>
      </div>

      {/* Stats */}
      <StatsBar anonymizedCalls={events.length} />

      {/* Cards */}
      {events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-600">
          <p>Privacy events will appear here</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3">
          {events.map((ev, i) => (
            <PrivacyCallCard key={ev.id} event={ev} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
