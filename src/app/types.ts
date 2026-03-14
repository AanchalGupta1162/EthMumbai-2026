// ──────────────────────────────────────────
// Trip
// ──────────────────────────────────────────
export interface TripConfig {
  from: string;
  to: string;
  maxFare: number;
  budget: number;
  autoBook: boolean;
}

// ──────────────────────────────────────────
// Agent events
// ──────────────────────────────────────────
export type AgentEventType =
  | "agent_start"
  | "checking_fares"
  | "payment_required"
  | "fare_found"
  | "no_match"
  | "booking_triggered"
  | "booked"
  | "budget_exhausted"
  | "agent_done";

export type AgentStepStatus = "pending" | "active" | "done" | "error";

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  label: string;
  detail?: string;
  status: AgentStepStatus;
  timestamp: number;
}

// ──────────────────────────────────────────
// Privacy events
// ──────────────────────────────────────────
export type PrivacyAction =
  | "wallet_created"
  | "delay_applied"
  | "payment_sent"
  | "data_received"
  | "wallet_destroyed";

export interface PrivacyEvent {
  id: string;
  walletAddress: string;
  fundingAmount: string;
  txHash: string;
  actions: { action: PrivacyAction; timestamp: number }[];
  status: "active" | "complete";
}

// ──────────────────────────────────────────
// Booking result
// ──────────────────────────────────────────
export interface BookingResult {
  bookingId: string;
  airline: string;
  from: string;
  to: string;
  fare: number;
  date: string;
  totalPaid: number;
  privacyCalls: number;
}

// ──────────────────────────────────────────
// Agent status (overall)
// ──────────────────────────────────────────
export type AgentStatus = "idle" | "running" | "completed" | "error";
