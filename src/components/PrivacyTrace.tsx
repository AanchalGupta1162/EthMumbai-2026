"use client";

import { useState, useEffect, useRef } from "react";
import type { TripPolicy, AgentEvent } from "@/lib/agent/runAgent";
import type { PrivacyEvent } from "@/lib/privacy/ghostPay";

export interface PrivacyTraceProps {
  tripPolicy: TripPolicy;
  autoStart?: boolean;
}

interface TraceEvent {
  id: string;
  type: string;
  text: string;
  colorClass: string;
  timestamp: number;
}

export default function PrivacyTrace({ tripPolicy, autoStart = false }: PrivacyTraceProps) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({ wallets: 0, spent: "0.00", calls: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const startTrace = async () => {
    setIsRunning(true);
    setEvents([]);
    setStats({ wallets: 0, spent: "0.00", calls: 0 });

    try {
      const response = await fetch("/api/privacy-trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tripPolicy),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const rawEvent = JSON.parse(jsonStr) as AgentEvent;
            handleEvent(rawEvent);
          } catch {
            // ignore malformed JSON
          }
        }
      }
    } catch (err: any) {
      pushEvent("error", `❌ Connection error: ${err.message}`, "text-red-400");
    } finally {
      setIsRunning(false);
    }
  };

  const pushEvent = (type: string, text: string, colorClass: string) => {
    setEvents((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), type, text, colorClass, timestamp: Date.now() },
    ]);
  };

  const truncate = (str: string, max = 12) => {
    if (!str || str.length <= max) return str;
    return `${str.slice(0, Math.floor(max / 2))}...${str.slice(-Math.floor(max / 2))}`;
  };

  const handleEvent = (ev: AgentEvent | { type: "agent_error"; message: string }) => {
    switch (ev.type) {
      case "agent_error":
        pushEvent("error", `❌ Agent Error: ${ev.message}`, "text-red-500 font-bold");
        break;
      case "spend_update":
        setStats((prev) => ({ ...prev, spent: ev.totalSpentUsdc }));
        pushEvent(
          "spend_update",
          `💰 Spent ${ev.totalSpentUsdc} / ${ev.budgetUsdc} USDC remaining: ${ev.remainingUsdc}`,
          "text-white"
        );
        break;
      case "policy_check":
        pushEvent(
          "policy_check",
          `🛡 Policy check for ${ev.path}: ${ev.allowed ? "ALLOWED" : "BLOCKED"} — ${ev.reason}`,
          "text-fuchsia-400"
        );
        break;
      case "privacy_event": {
        const pe = ev.data;
        switch (pe.type) {
          case "delay_applied":
            setStats((prev) => ({ ...prev, calls: prev.calls + 1 }));
            pushEvent(
              "delay",
              `⏱ [call #${pe.callId}] Delay ${pe.delayMs}ms applied for ${pe.path}`,
              "text-yellow-400"
            );
            break;
          case "wallet_created":
            setStats((prev) => ({ ...prev, wallets: prev.wallets + 1 }));
            pushEvent(
              "wallet",
              `🔑 [call #${pe.callId}] Ephemeral ${truncate(pe.ephemeralAddress)} created, funded ${pe.fundingAmountUsdc} USDC (tx: ${truncate(pe.fundingTxHash)})`,
              "text-blue-400"
            );
            break;
          case "payment_sent":
            pushEvent(
              "payment",
              `💸 [call #${pe.callId}] Paid ${pe.amountPaidUsdc} USDC to ${pe.sellerUrl} (settle: ${truncate(pe.settleTxHash || "pending")})`,
              "text-emerald-400"
            );
            break;
          case "data_received":
            pushEvent(
              "response",
              `📦 [call #${pe.callId}] Response ${pe.responseStatus} received from ${pe.path}`,
              "text-cyan-400"
            );
            break;
          case "wallet_destroyed":
            pushEvent(
              "destroy",
              `🔥 [call #${pe.callId}] Ephemeral ${truncate(pe.ephemeralAddress)} destroyed (success: ${pe.success})`,
              "text-zinc-500"
            );
            break;
          case "error":
            pushEvent(
              "error",
              `❌ [call #${pe.callId}] Error at stage '${pe.stage}': ${pe.errorMessage}`,
              "text-red-400"
            );
            break;
        }
        break;
      }
    }
  };

  useEffect(() => {
    if (autoStart) startTrace();
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden font-mono text-sm leading-relaxed shadow-xl">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <span>Wallets Created: <span className="text-zinc-100">{stats.wallets}</span></span>
          <span className="text-zinc-600">|</span>
          <span>Total Spent: <span className="text-emerald-400">{stats.spent} USDC</span></span>
          <span className="text-zinc-600">|</span>
          <span>Calls Made: <span className="text-zinc-100">{stats.calls}</span></span>
        </div>
        <button
          onClick={startTrace}
          disabled={isRunning}
          className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs text-white uppercase tracking-wider font-semibold transition-colors"
        >
          {isRunning ? "Running..." : "Run Trace"}
        </button>
      </div>

      {/* Terminal window */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1.5 scroll-smooth"
      >
        {events.length === 0 && !isRunning && (
          <div className="text-zinc-600 italic">No events yet. Click Run Trace to start.</div>
        )}
        {events.map((ev) => (
          <div key={ev.id} className={`${ev.colorClass} break-all`}>
            {ev.text}
          </div>
        ))}
      </div>
    </div>
  );
}
