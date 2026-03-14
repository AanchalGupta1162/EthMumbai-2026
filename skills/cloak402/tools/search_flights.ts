// skills/cloak402/tools/search_flights.ts
//
// CLI tool for anonymous flight search via the ghostPay privacy layer.
// Invoked by OpenClaw agent: npx tsx skills/cloak402/tools/search_flights.ts --from BOM --to BLR --maxFare 4500
//
// stdout: structured JSON result (consumed by OpenClaw)
// stderr: privacy events (captured by the event bridge)

import { ghostPay } from "../../../src/lib/privacy/ghostPay";
import type { PrivacyEvent } from "../../../src/lib/privacy/ghostPay";

function parseArgs(): { from: string; to: string; maxFare?: number } {
  const args = process.argv.slice(2);
  const map: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const val = args[i + 1];
    if (key && val) map[key] = val;
  }
  if (!map.from || !map.to) {
    process.stdout.write(JSON.stringify({ error: "Missing required args: --from and --to" }) + "\n");
    process.exit(1);
  }
  return {
    from: map.from,
    to: map.to,
    maxFare: map.maxFare ? Number(map.maxFare) : undefined,
  };
}

async function main() {
  const params = parseArgs();
  const privacyLog: PrivacyEvent[] = [];

  const result = await ghostPay<{ flights: any[]; searchedAt: number }>(
    "/search-flights",
    {
      from: params.from,
      to: params.to,
      ...(params.maxFare != null ? { maxFare: params.maxFare } : {}),
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
