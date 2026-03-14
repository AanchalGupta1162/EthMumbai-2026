"use client";

import { useState, useCallback, useRef } from "react";
import Header from "./components/Header";
import TripForm from "./components/TripForm";
import AgentActivity from "./components/AgentActivity";
import PrivacyPanel from "./components/PrivacyPanel";
import BookingSuccessCard from "./components/BookingSuccessCard";
import type {
  TripConfig,
  AgentEvent,
  PrivacyEvent,
  BookingResult,
  AgentStatus,
} from "./types";

// ── Helpers ────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function truncateAddr(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/** Map a raw backend AgentEvent into the UI's display format */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUiAgentEvent(raw: Record<string, any>): AgentEvent | null {
  const now = Date.now();
  switch (raw.type) {
    case "agent_start":
      return {
        id: uid(),
        type: "agent_start",
        label: "Agent initialized",
        detail: `Monitoring fares for ${raw.data?.policy?.from ?? "?"} → ${raw.data?.policy?.to ?? "?"}`,
        status: "done",
        timestamp: now,
      };
    case "checking_fares":
      return {
        id: uid(),
        type: "checking_fares",
        label: `Checking fares — attempt #${raw.data?.attempt}`,
        detail: "Querying airline fare endpoint…",
        status: "active",
        timestamp: now,
      };
    case "fare_found":
      return {
        id: uid(),
        type: "fare_found",
        label: "Fare match found",
        detail: `${raw.data?.flight?.airline} ${raw.data?.flight?.from}→${raw.data?.flight?.to} ₹${Number(raw.data?.flight?.fare).toLocaleString()}`,
        status: "done",
        timestamp: now,
      };
    case "no_match":
      return {
        id: uid(),
        type: "no_match",
        label: "No matching fares",
        detail: `Attempt #${raw.data?.attempt} — will retry`,
        status: "done",
        timestamp: now,
      };
    case "booking_triggered":
      return {
        id: uid(),
        type: "booking_triggered",
        label: "Booking triggered",
        detail: `Auto-booking ${raw.data?.flight?.airline} ${raw.data?.flight?.from}→${raw.data?.flight?.to}`,
        status: "active",
        timestamp: now,
      };
    case "booked":
      return {
        id: uid(),
        type: "booked",
        label: "Booking confirmed ✓",
        detail: `${raw.data?.booking?.bookingId} — ticket ${raw.data?.booking?.ticketNumber}`,
        status: "done",
        timestamp: now,
      };
    case "budget_exhausted":
      return {
        id: uid(),
        type: "budget_exhausted",
        label: "Budget exhausted",
        detail: `Spent: ${raw.data?.spent}`,
        status: "done",
        timestamp: now,
      };
    case "agent_done":
      return {
        id: uid(),
        type: "agent_done",
        label: "Agent completed",
        detail: "All tasks finished — your identity was never revealed",
        status: "done",
        timestamp: now,
      };
    case "policy_check":
      return {
        id: uid(),
        type: "checking_fares",
        label: `🛡 Policy check: ${raw.path}`,
        detail: `${raw.allowed ? "ALLOWED" : "BLOCKED"} — ${raw.reason}`,
        status: "done",
        timestamp: now,
      };
    case "spend_update":
      return {
        id: uid(),
        type: "payment_required",
        label: `💰 Spend update`,
        detail: `${raw.totalSpentUsdc} / ${raw.budgetUsdc} USDC — remaining: ${raw.remainingUsdc}`,
        status: "done",
        timestamp: now,
      };
    case "agent_message":
      return {
        id: uid(),
        type: "agent_message",
        label: "Agent",
        detail: String((raw.data as Record<string, unknown>).text ?? ""),
        status: "done",
        timestamp: now,
      };
    default:
      return null;
  }
}

// ── Privacy event tracking ────────────────────
// We group individual PrivacyEvents (from ghostPay) per callId into full PrivacyEvent cards.
type PrivacyCallRecord = {
  callId: number;
  walletAddress: string;
  fundingAmount: string;
  txHash: string;
  actions: { action: PrivacyEvent["actions"][number]["action"]; timestamp: number }[];
  status: "active" | "complete";
};

export default function Home() {
  // ── State ──────────────────────────────────
  const [tripConfig, setTripConfig] = useState<TripConfig>({
    from: "BOM",
    to: "BLR",
    maxFare: 4500,
    budget: 0.01,
    autoBook: true,
    passenger: { name: "", email: "" },
  });

  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [privacyEvents, setPrivacyEvents] = useState<PrivacyEvent[]>([]);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  // Track privacy calls by callId for grouping
  const privacyCallsRef = useRef<Map<number, PrivacyCallRecord>>(new Map());
  const privacyCountRef = useRef(0);

  const flushPrivacyEvents = useCallback(() => {
    const records = Array.from(privacyCallsRef.current.values());
    const asEvents: PrivacyEvent[] = records.map((r) => ({
      id: `privacy-${r.callId}`,
      walletAddress: r.walletAddress,
      fundingAmount: r.fundingAmount,
      txHash: r.txHash,
      actions: r.actions,
      status: r.status,
    }));
    setPrivacyEvents(asEvents);
  }, []);

  // ── Process a raw backend privacy event (new flattened format) ────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePrivacyEvent = useCallback(
    (pe: Record<string, any>) => {
      const callId = pe.callId as number;
      if (!privacyCallsRef.current.has(callId)) {
        privacyCallsRef.current.set(callId, {
          callId,
          walletAddress: "",
          fundingAmount: "",
          txHash: "",
          actions: [],
          status: "active",
        });
      }
      const record = privacyCallsRef.current.get(callId)!;
      const now = Date.now();

      switch (pe.type) {
        case "delay_applied":
          record.actions.push({ action: "delay_applied", timestamp: now });
          break;
        case "wallet_created":
          record.walletAddress = String(pe.ephemeralAddress ?? "");
          record.fundingAmount = `${pe.fundingAmountUsdc ?? "?"} USDC`;
          record.txHash = String(pe.fundingTxHash ?? "");
          record.actions.push({ action: "wallet_created", timestamp: now });
          break;
        case "payment_sent":
          if (pe.settleTxHash) record.txHash = String(pe.settleTxHash);
          record.actions.push({ action: "payment_sent", timestamp: now });
          break;
        case "data_received":
          record.actions.push({ action: "data_received", timestamp: now });
          break;
        case "wallet_destroyed":
          record.actions.push({ action: "wallet_destroyed", timestamp: now });
          record.status = "complete";
          break;
        case "error":
          record.status = "complete";
          break;
      }

      flushPrivacyEvents();
    },
    [flushPrivacyEvents]
  );

  // ── Start agent (real SSE) ────────────────
  const startAgent = useCallback(() => {
    // Reset
    setAgentEvents([]);
    setPrivacyEvents([]);
    setBooking(null);
    setShowBooking(false);
    setAgentStatus("running");
    privacyCallsRef.current = new Map();
    privacyCountRef.current = 0;

    const body = {
      from: tripConfig.from,
      to: tripConfig.to,
      maxFare: tripConfig.maxFare,
      budget: tripConfig.budget,
      autoBook: tripConfig.autoBook,
      passenger: tripConfig.passenger,
    };

    fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          setAgentStatus("error");
          return;
        }

        const reader = res.body.getReader();
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = JSON.parse(jsonStr) as Record<string, any>;

              // Handle privacy events (nested from ghostPay, now flattened)
              if (raw.type === "privacy_event") {
                const pe = raw.data as Record<string, any>;
                handlePrivacyEvent(pe);
                privacyCountRef.current++;

                // Also add a UI timeline event for payment_sent
                if (pe.type === "payment_sent") {
                  setAgentEvents((prev) => {
                    const updated = prev.map((e) =>
                      e.status === "active" ? { ...e, status: "done" as const } : e
                    );
                    return [
                      ...updated,
                      {
                        id: uid(),
                        type: "payment_required" as const,
                        label: "x402 payment sent",
                        detail: `Ephemeral ${truncateAddr(String(pe.ephemeralAddress ?? ""))} → ${pe.amountPaidUsdc ?? "?"} USDC`,
                        status: "done" as const,
                        timestamp: Date.now(),
                      },
                    ];
                  });
                }
                continue;
              }

              // Handle booked — extract booking result for overlay
              if (raw.type === "booked") {
                const b = raw.data.booking as Record<string, unknown>;
                const flight = b?.flight as Record<string, unknown>;
                const passenger = b?.passenger as Record<string, unknown>;
                if (flight) {
                  setBooking({
                    bookingId: String(b?.bookingId ?? ""),
                    ticketNumber: String(b?.ticketNumber ?? ""),
                    airline: String(flight.airline ?? ""),
                    from: String(flight.from ?? ""),
                    to: String(flight.to ?? ""),
                    fare: Number(flight.fare ?? 0),
                    date: String(flight.date ?? ""),
                    passenger: {
                      name: String(passenger?.name ?? tripConfig.passenger.name),
                      email: String(passenger?.email ?? tripConfig.passenger.email),
                    },
                    totalPaid: Number((privacyCountRef.current * 0.001).toFixed(4)),
                    privacyCalls: privacyCallsRef.current.size,
                  });
                  setTimeout(() => setShowBooking(true), 400);
                }
              }

              // Map to UI agent event
              const uiEvent = toUiAgentEvent(raw);
              if (uiEvent) {
                setAgentEvents((prev) => {
                  const updated = prev.map((e) =>
                    e.status === "active" ? { ...e, status: "done" as const } : e
                  );
                  return [...updated, uiEvent];
                });
              }

              // Mark complete on agent_done
              if (raw.type === "agent_done") {
                setAgentStatus("completed");
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // Stream ended
        setAgentStatus((prev) => (prev === "running" ? "completed" : prev));
      })
      .catch(() => {
        setAgentStatus("error");
      });
  }, [tripConfig, handlePrivacyEvent]);

  const isRunning = agentStatus === "running";

  // ── Render ─────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Dashboard grid */}
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 h-[calc(100vh-88px)]">
          {/* Left — Trip Control */}
          <div className="lg:col-span-3" id="trip-panel">
            <TripForm
              config={tripConfig}
              onChange={setTripConfig}
              onStart={startAgent}
              disabled={isRunning}
            />
          </div>

          {/* Center — Agent Activity */}
          <div className="lg:col-span-5" id="agent-panel">
            <AgentActivity
              events={agentEvents}
              agentStatus={agentStatus}
            />
          </div>

          {/* Right — Privacy Layer */}
          <div className="lg:col-span-4" id="privacy-panel">
            <PrivacyPanel events={privacyEvents} />
          </div>
        </div>
      </main>

      {/* Booking success overlay */}
      {showBooking && booking && (
        <BookingSuccessCard
          booking={booking}
          onDismiss={() => setShowBooking(false)}
        />
      )}
    </div>
  );
}
