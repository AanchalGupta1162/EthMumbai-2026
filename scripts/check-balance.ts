import { createPublicClient, http, formatEther } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org")
});

async function main() {
  const balance = await publicClient.getBalance({ address: "0x6d7b74eEd944E6DBA446D8e24898626A592ac3b2" });
  console.log("Balance:", formatEther(balance), "ETH");
}
main();
