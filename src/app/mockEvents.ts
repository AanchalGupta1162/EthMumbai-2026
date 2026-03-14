import { AgentEvent, PrivacyEvent, BookingResult } from "./types";

// ── Helpers ─────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function randomHex(bytes: number) {
  return (
    "0x" +
    Array.from({ length: bytes }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
    ).join("")
  );
}

function randomAmount() {
  return (0.0001 + Math.random() * 0.0009).toFixed(6);
}

// ── Mock agent event sequence ───────────────
// Each entry is [delay_ms, event_factory]
export const MOCK_AGENT_SEQUENCE: [number, () => AgentEvent][] = [
  [
    400,
    () => ({
      id: uid(),
      type: "agent_start",
      label: "Agent initialized",
      detail: "Monitoring fares for BOM → BLR",
      status: "done",
      timestamp: Date.now(),
    }),
  ],
  [
    1200,
    () => ({
      id: uid(),
      type: "checking_fares",
      label: "Checking fare API",
      detail: "Querying airline fare endpoint…",
      status: "active",
      timestamp: Date.now(),
    }),
  ],
  [
    800,
    () => ({
      id: uid(),
      type: "payment_required",
      label: "Payment required (x402)",
      detail: "API returned 402 — preparing onchain payment",
      status: "done",
      timestamp: Date.now(),
    }),
  ],
  [
    1500,
    () => ({
      id: uid(),
      type: "checking_fares",
      label: "Fare data received",
      detail: "3 flights found in price range",
      status: "done",
      timestamp: Date.now(),
    }),
  ],
  [
    600,
    () => ({
      id: uid(),
      type: "fare_found",
      label: "Fare match found",
      detail: "SpiceJet BOM→BLR ₹3,800 — below ₹4,500 threshold",
      status: "done",
      timestamp: Date.now(),
    }),
  ],
  [
    1000,
    () => ({
      id: uid(),
      type: "booking_triggered",
      label: "Booking triggered",
      detail: "Auto-book enabled — initiating booking…",
      status: "active",
      timestamp: Date.now(),
    }),
  ],
  [
    800,
    () => ({
      id: uid(),
      type: "payment_required",
      label: "Booking payment (x402)",
      detail: "Booking API requires payment — using ephemeral wallet",
      status: "done",
      timestamp: Date.now(),
    }),
  ],
  [
    1800,
    () => ({
      id: uid(),
      type: "booked",
      label: "Booking confirmed ✓",
      detail: "Booking ID BK1710400000000 confirmed",
      status: "done",
      timestamp: Date.now(),
    }),
  ],
  [
    500,
    () => ({
      id: uid(),
      type: "agent_done",
      label: "Agent completed",
      detail: "All tasks finished — your identity was never revealed",
      status: "done",
      timestamp: Date.now(),
    }),
  ],
];

// ── Mock privacy events ─────────────────────
export function createMockPrivacyEvent(index: number): PrivacyEvent {
  const now = Date.now();
  const addr = randomHex(20);
  const tx = randomHex(32);
  return {
    id: uid(),
    walletAddress: addr,
    fundingAmount: `${randomAmount()} ETH`,
    txHash: tx,
    actions: [
      { action: "wallet_created", timestamp: now },
      { action: "delay_applied", timestamp: now + 200 },
      { action: "payment_sent", timestamp: now + 600 },
      { action: "data_received", timestamp: now + 1000 },
      { action: "wallet_destroyed", timestamp: now + 1400 },
    ],
    status: "complete",
  };
}

// ── Mock booking result ─────────────────────
export const MOCK_BOOKING: BookingResult = {
  bookingId: "BK" + Date.now(),
  airline: "SpiceJet",
  from: "BOM",
  to: "BLR",
  fare: 3800,
  date: "2026-03-21",
  totalPaid: 0.006,
  privacyCalls: 2,
};
