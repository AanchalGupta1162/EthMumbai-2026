// scripts/testGhostPay.ts
import { ghostPay } from "../src/lib/privacy/ghostPay";
import type { PrivacyEvent } from "../src/lib/privacy/ghostPay";

const startTime = Date.now();

function ts(): string {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  return `[+${elapsed}s]`;
}

async function main() {
  console.log(`${ts()} 🔒 testGhostPay — calling /search-flights\n`);

  const flights = await ghostPay<{ flights: any[] }>(
    "/search-flights",
    { from: "BOM", to: "BLR", maxFare: 4500 },
    (event: PrivacyEvent) => {
      switch (event.type) {
        case "delay_applied":
          console.log(
            `${ts()} ⏳ [call #${event.callId}] delay applied: ${event.delayMs}ms`
          );
          break;
        case "wallet_created":
          console.log(
            `${ts()} 🆕 [call #${event.callId}] wallet created: ${event.ephemeralAddress}`
          );
          console.log(
            `${ts()}    funded: ${event.fundingAmountUsdc} USDC`
          );
          break;
        case "payment_sent":
          console.log(
            `${ts()} 💸 [call #${event.callId}] payment tx: ${event.settleTxHash || "n/a"}`
          );
          console.log(
            `${ts()}    seller: ${event.sellerUrl || "n/a"}`
          );
          break;
        case "data_received":
          console.log(
            `${ts()} 📦 [call #${event.callId}] data received`
          );
          break;
        case "wallet_destroyed":
          console.log(
            `${ts()} 🔥 [call #${event.callId}] wallet destroyed: ${event.ephemeralAddress}`
          );
          break;
        case "error":
          console.log(
            `${ts()} ❌ [call #${event.callId}] error at ${event.stage}: ${event.errorMessage}`
          );
          break;
      }
    }
  );

  console.log(`\n${ts()} ✈️  Flight data returned:`);
  console.log(JSON.stringify(flights, null, 2));
}

main().catch((err) => {
  console.error(`\n${ts()} ❌ Error:`, err);
  process.exit(1);
});
