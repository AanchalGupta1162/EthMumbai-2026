// src/lib/agent/runAgent.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { ghostPay } from "../privacy/ghostPay";
import type { PrivacyEvent } from "../privacy/ghostPay";

// ── Exported types ──────────────────────────────────────────────────────

export type TripPolicy = {
  from: string;
  to: string;
  maxFare: number;
  budget: number;
  autoBook: boolean;
  passenger: { name: string; email: string };
};

export type FlightResult = {
  id: string;
  airline: string;
  from: string;
  to: string;
  fare: number;
  date: string;
};

export type BookingResult = {
  bookingId: string;
  ticketNumber: string;
  flight: FlightResult;
  passenger: { name: string; email: string };
  status: string;
  bookedAt: number;
};

export type AgentEvent =
  | { type: "agent_start"; data: { policy: TripPolicy } }
  | { type: "checking_fares"; data: { attempt: number } }
  | { type: "fare_found"; data: { flight: FlightResult } }
  | { type: "no_match"; data: { attempt: number } }
  | { type: "booking_triggered"; data: { flight: FlightResult } }
  | { type: "booked"; data: { booking: BookingResult } }
  | { type: "budget_exhausted"; data: { spent: number } }
  | { type: "agent_done"; data: { spent: number } }
  | { type: "privacy_event"; data: PrivacyEvent };

// ── Main agent loop ─────────────────────────────────────────────────────

export async function runAgent(
  policy: TripPolicy,
  onEvent: (event: AgentEvent) => void
): Promise<void> {
  // STEP 1: Fire agent_start
  onEvent({ type: "agent_start", data: { policy } });

  // STEP 2: Initialize spent counter
  let spent = 0;

  // STEP 3: Loop up to 3 times
  for (let i = 0; i < 3; i++) {
    // a. Check budget
    if (spent >= policy.budget) {
      onEvent({ type: "budget_exhausted", data: { spent } });
      return;
    }

    // b. Fire checking_fares
    onEvent({ type: "checking_fares", data: { attempt: i + 1 } });

    // c. Search flights via ghostPay
    const result = await ghostPay<{ flights: FlightResult[] }>(
      "/search-flights",
      { from: policy.from, to: policy.to, maxFare: policy.maxFare },
      (privacyEvent: PrivacyEvent) =>
        onEvent({ type: "privacy_event", data: privacyEvent })
    );

    // d. Increment spent by search cost
    spent += 0.001;

    // e. Sort by fare ascending, take cheapest
    const flights = result.flights ?? [];
    const sorted = flights.sort((a, b) => a.fare - b.fare);
    const cheapest = sorted[0];

    if (!cheapest) {
      onEvent({ type: "no_match", data: { attempt: i + 1 } });
      continue;
    }

    // f. Fire fare_found
    onEvent({ type: "fare_found", data: { flight: cheapest } });

    // g. Auto-book if conditions met
    if (policy.autoBook && cheapest.fare <= policy.maxFare) {
      onEvent({ type: "booking_triggered", data: { flight: cheapest } });

      // IDENTITY RULE: passenger data is ONLY sent during booking, never during search
      const booking = await ghostPay<BookingResult>(
        "/book-flight",
        { flightId: cheapest.id, passenger: policy.passenger },
        (privacyEvent: PrivacyEvent) =>
          onEvent({ type: "privacy_event", data: privacyEvent })
      );

      spent += 0.005;
      onEvent({ type: "booked", data: { booking } });
      return; // done — no more polling
    }

    // h. autoBook false or fare too high — continue looping
  }

  // STEP 4: Loop ended without booking
  onEvent({ type: "agent_done", data: { spent } });
}
