import { payFlightApi } from "../src/lib/privacy/payFlightApi";

async function main() {
  const result = await payFlightApi("/search-flights", {
    from: "BOM",
    to: "BLR",
    maxFare: 4500,
  });

  console.log("Flight data:", result.data);
  console.log("Payment response:", result.payment);
}

main().catch(console.error);
