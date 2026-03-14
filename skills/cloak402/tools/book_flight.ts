// skills/cloak402/tools/book_flight.ts
//
// CLI tool for booking a flight via the ghostPay privacy layer.
// This is the ONLY tool that transmits passenger identity.
// Invoked by OpenClaw agent: npx tsx skills/cloak402/tools/book_flight.ts --flightId F001 --passengerName "John Doe" --passengerEmail john@example.com
//
// stdout: structured JSON result (consumed by OpenClaw)
// stderr: privacy events (captured by the event bridge)

import { ghostPay } from "../../../src/lib/privacy/ghostPay";
import type { PrivacyEvent } from "../../../src/lib/privacy/ghostPay";

function parseArgs(): { flightId: string; passengerName: string; passengerEmail: string } {
  const args = process.argv.slice(2);
  const map: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const val = args[i + 1];
    if (key && val) map[key] = val;
  }
  if (!map.flightId || !map.passengerName || !map.passengerEmail) {
    process.stdout.write(
      JSON.stringify({ error: "Missing required args: --flightId, --passengerName, --passengerEmail" }) + "\n"
    );
    process.exit(1);
  }
  return {
    flightId: map.flightId,
    passengerName: map.passengerName,
    passengerEmail: map.passengerEmail,
  };
}

async function main() {
  const params = parseArgs();
  const privacyLog: PrivacyEvent[] = [];

  const result = await ghostPay(
    "/book-flight",
    {
      flightId: params.flightId,
      passenger: { name: params.passengerName, email: params.passengerEmail },
    },
    (event) => {
      privacyLog.push(event);
      process.stderr.write(JSON.stringify({ channel: "privacy", event }) + "\n");
    }
  );

  const walletEvent = privacyLog.find((e) => e.type === "wallet_created");
  const paymentEvent = privacyLog.find((e) => e.type === "payment_sent");

  process.stdout.write(
    JSON.stringify({
      ...result,
      privacy: {
        walletUsed: walletEvent?.type === "wallet_created" ? walletEvent.ephemeralAddress : null,
        walletDestroyed: true,
        txHash: paymentEvent?.type === "payment_sent" ? paymentEvent.settleTxHash : null,
      },
    }) + "\n"
  );
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ error: err.message }) + "\n");
  process.exit(1);
});
