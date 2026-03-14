import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const key = process.env.AGENT_CONTROL_WALLET_KEY!;
  const formatted = key.startsWith("0x") ? key : `0x${key}`;
  const account = privateKeyToAccount(formatted as `0x${string}`);

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC),
  });

  const ethBalance = await client.getBalance({ address: account.address });
  console.log("Control wallet:", account.address);
  console.log("ETH balance:", formatEther(ethBalance));

  const usdcBalance = await client.readContract({
    address: process.env.USDC_ADDRESS as `0x${string}`,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
      },
    ],
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("USDC balance:", formatUnits(usdcBalance, 6));
}

main();
