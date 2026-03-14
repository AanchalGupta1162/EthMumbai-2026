"use client";

import { AgentEvent, AgentStatus } from "../types";

interface AgentActivityProps {
  events: AgentEvent[];
  agentStatus: AgentStatus;
}

const ICON_MAP: Record<string, string> = {
  agent_start: "🚀",
  checking_fares: "🔍",
  payment_required: "💳",
  fare_found: "✈️",
  no_match: "⏳",
  booking_triggered: "📋",
  booked: "✅",
  budget_exhausted: "⚠️",
  agent_done: "🏁",
};

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-zinc-800 text-zinc-500",
    active: "bg-amber-400/10 text-amber-400 border border-amber-400/20",
    done: "bg-emerald-400/10 text-emerald-400",
    error: "bg-red-400/10 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${styles[status] ?? styles.pending}`}
    >
      {status === "active" && (
        <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse-dot" />
      )}
      {status}
    </span>
  );
}

export default function AgentActivity({
  events,
  agentStatus,
}: AgentActivityProps) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-dark">
          Agent Activity
        </h2>
        {agentStatus === "running" && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            Live
          </span>
        )}
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-600">
          <p>Configure your trip and start the agent</p>
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-1">
          {events.map((event, i) => (
            <div
              key={event.id}
              className="animate-fade-in-up flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Icon */}
              <span className="text-base mt-0.5 shrink-0">
                {ICON_MAP[event.type] ?? "•"}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{event.label}</p>
                  <StatusChip status={event.status} />
                </div>
                {event.detail && (
                  <p className="text-xs text-muted-dark mt-0.5 truncate">
                    {event.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
