"use client";

import { BookingResult } from "../types";

interface BookingSuccessCardProps {
  booking: BookingResult;
  onDismiss: () => void;
}

export default function BookingSuccessCard({
  booking,
  onDismiss,
}: BookingSuccessCardProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Card */}
      <div className="relative glass-card p-8 max-w-md w-full mx-4 animate-fade-in-up shadow-2xl shadow-emerald-500/10">
        {/* Checkmark */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-950 animate-check"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-bold text-center mb-1">
          Ticket Booked ✓
        </h3>
        <p className="text-sm text-muted-dark text-center mb-6">
          Your flight has been booked privately
        </p>

        {/* Details */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-dark">Route</span>
            <span className="font-medium">
              {booking.from} → {booking.to}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-dark">Airline</span>
            <span className="font-medium">{booking.airline}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-dark">Fare</span>
            <span className="font-medium">₹{booking.fare.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-dark">Date</span>
            <span className="font-medium">{booking.date}</span>
          </div>

          <div className="border-t border-white/5 pt-3 mt-3" />

          <div className="flex justify-between text-sm">
            <span className="text-muted-dark">Passenger</span>
            <span className="font-medium">{booking.passenger.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-dark">Email</span>
            <span className="font-mono text-xs text-cyan-400">
              {booking.passenger.email}
            </span>
          </div>

          <div className="border-t border-white/5 pt-3 mt-3" />

          <div className="flex justify-between text-sm">
            <span className="text-muted-dark">Booking ID</span>
            <span className="font-mono text-xs text-cyan-400">
              {booking.bookingId}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-dark">Ticket Number</span>
            <span className="font-mono text-xs text-emerald-400">
              {booking.ticketNumber}
            </span>
          </div>

          <div className="border-t border-white/5 pt-3 mt-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-dark">Total onchain cost</span>
              <span className="font-mono text-emerald-400">
                {booking.totalPaid} USDC
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-dark">Privacy calls used</span>
              <span className="font-mono text-emerald-400">
                {booking.privacyCalls}
              </span>
            </div>
          </div>
        </div>

        {/* Privacy badge */}
        <div className="glass-card-sm p-3 flex items-center gap-3 mb-5">
          <span className="text-lg">🛡️</span>
          <div>
            <p className="text-xs font-medium text-emerald-400">
              Privacy Preserved
            </p>
            <p className="text-[11px] text-muted-dark">
              Your real wallet was never exposed to the airline API
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-xl border border-white/10 text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
