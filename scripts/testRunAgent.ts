// scripts/testRunAgent.ts
import { runAgent } from "../src/lib/agent/runAgent";
import type { AgentEvent, TripPolicy } from "../src/lib/agent/runAgent";

const startTime = Date.now();

function ts(): string {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  return `[+${elapsed}s]`;
}

const policy: TripPolicy = {
  from: "BOM",
  to: "BLR",
  maxFare: 4500,
  budget: 10000,
  autoBook: true,
};

async function main() {
  console.log(`${ts()} 🤖 testRunAgent — starting agent\n`);
  console.log(`Policy: ${JSON.stringify(policy, null, 2)}\n`);

  await runAgent(policy, (event: AgentEvent) => {
    switch (event.type) {
      case "agent_start":
        console.log(`${ts()} 🚀 AGENT_START`);
        break;
      case "checking_fares":
        console.log(
          `\n${ts()} 🔍 CHECKING_FARES — attempt #${event.data.attempt}`
        );
        break;
      case "fare_found":
        console.log(
          `${ts()} ✈️  FARE_FOUND — ${event.data.flight.airline} ${event.data.flight.from}→${event.data.flight.to} ₹${event.data.flight.fare}`
        );
        break;
      case "no_match":
        console.log(
          `${ts()} ❌ NO_MATCH — attempt #${event.data.attempt}`
        );
        break;
      case "booking_triggered":
        console.log(
          `${ts()} 📝 BOOKING_TRIGGERED — flight ${event.data.flight.id}`
        );
        break;
      case "booked":
        console.log(
          `${ts()} ✅ BOOKED — bookingId: ${event.data.booking.bookingId}, status: ${event.data.booking.status}`
        );
        break;
      case "budget_exhausted":
        console.log(
          `${ts()} 💸 BUDGET_EXHAUSTED — spent: ${event.data.spent}`
        );
        break;
      case "agent_done":
        console.log(
          `\n${ts()} 🏁 AGENT_DONE — total spent: ${event.data.spent} USDC`
        );
        break;
      case "privacy_event": {
        const pe = event.data;
        switch (pe.type) {
          case "delay_applied":
            console.log(
              `${ts()}   🔒 privacy [call #${pe.callId}] delay: ${pe.data.ms}ms`
            );
            break;
          case "wallet_created":
            console.log(
              `${ts()}   🔒 privacy [call #${pe.callId}] wallet: ${pe.data.address} (${pe.data.amount} USDC)`
            );
            break;
          case "payment_sent":
            console.log(
              `${ts()}   🔒 privacy [call #${pe.callId}] payment tx: ${pe.data.scanUrl ?? "n/a"}`
            );
            break;
          case "data_received":
            console.log(
              `${ts()}   🔒 privacy [call #${pe.callId}] data received`
            );
            break;
          case "wallet_destroyed":
            console.log(
              `${ts()}   🔒 privacy [call #${pe.callId}] wallet destroyed: ${pe.data.address}`
            );
            break;
        }
        break;
      }
    }
  });

  console.log(`\n${ts()} 🎉 Agent run complete.`);
}

main().catch((err) => {
  console.error(`\n${ts()} ❌ Error:`, err);
  process.exit(1);
});
