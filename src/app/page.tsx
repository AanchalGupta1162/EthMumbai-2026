"use client";

import { useState, useCallback, useRef } from "react";
import Header from "./components/Header";
import TripForm from "./components/TripForm";
import AgentActivity from "./components/AgentActivity";
import PrivacyPanel from "./components/PrivacyPanel";
import BookingSuccessCard from "./components/BookingSuccessCard";
import {
  MOCK_AGENT_SEQUENCE,
  createMockPrivacyEvent,
  MOCK_BOOKING,
} from "./mockEvents";
import type {
  TripConfig,
  AgentEvent,
  PrivacyEvent,
  BookingResult,
  AgentStatus,
} from "./types";

export default function Home() {
  // ── State ──────────────────────────────────
  const [tripConfig, setTripConfig] = useState<TripConfig>({
    from: "BOM",
    to: "BLR",
    maxFare: 4500,
    budget: 0.01,
    autoBook: true,
  });

  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [privacyEvents, setPrivacyEvents] = useState<PrivacyEvent[]>([]);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Start agent (mock demo) ────────────────
  // Replace this function body with real SSE subscription later.
  const startAgent = useCallback(() => {
    // Reset
    setAgentEvents([]);
    setPrivacyEvents([]);
    setBooking(null);
    setShowBooking(false);
    setAgentStatus("running");

    // Clear any leftover timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    let cumulativeDelay = 0;
    let privacyIndex = 0;

    MOCK_AGENT_SEQUENCE.forEach(([delayMs, factory], i) => {
      cumulativeDelay += delayMs;

      const timer = setTimeout(() => {
        const event = factory();

        // Mark previously "active" events as "done"
        setAgentEvents((prev) => {
          const updated = prev.map((e) =>
            e.status === "active" ? { ...e, status: "done" as const } : e
          );
          return [...updated, event];
        });

        // Inject privacy event on payment_required steps
        if (event.type === "payment_required") {
          const pEvent = createMockPrivacyEvent(privacyIndex++);
          setPrivacyEvents((prev) => [...prev, pEvent]);
        }

        // Show booking overlay on 'booked' event
        if (event.type === "booked") {
          setBooking(MOCK_BOOKING);
          setTimeout(() => setShowBooking(true), 400);
        }

        // Mark agent complete on last event
        if (i === MOCK_AGENT_SEQUENCE.length - 1) {
          setAgentStatus("completed");
        }
      }, cumulativeDelay);

      timersRef.current.push(timer);
    });
  }, []);

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
