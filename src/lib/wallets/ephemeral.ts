// src/lib/wallets/ephemeral.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
} from "viem";
import { baseSepolia } from "viem/chains";

// ── Env guards ──────────────────────────────────────────────────────────
const AGENT_CONTROL_WALLET_KEY = process.env.AGENT_CONTROL_WALLET_KEY;
if (!AGENT_CONTROL_WALLET_KEY)
  throw new Error("AGENT_CONTROL_WALLET_KEY is missing in .env.local");

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC;
if (!BASE_SEPOLIA_RPC)
  throw new Error("BASE_SEPOLIA_RPC is missing in .env.local");

const USDC_ADDRESS = process.env.USDC_ADDRESS;
if (!USDC_ADDRESS) throw new Error("USDC_ADDRESS is missing in .env.local");

// ── Minimal USDC ABI (only transfer) ───────────────────────────────────
const usdcAbi = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// ── Exported types ──────────────────────────────────────────────────────
export type EphemeralWallet = {
  account: ReturnType<typeof privateKeyToAccount>;
  address: string;
  fundedAmount: string;
  destroy: () => void;
};

// ── Main factory ────────────────────────────────────────────────────────
export async function createEphemeralWallet(): Promise<EphemeralWallet> {
  // STEP 1: Generate a fresh private key entirely in memory
  let privateKey = generatePrivateKey();

  // STEP 2: Derive account from the key
  const account = privateKeyToAccount(privateKey);

  // STEP 3: Randomize funding amount between 0.03 and 0.09 USDC
  const amount = (Math.random() * 0.06 + 0.03).toFixed(4);
  const amountParsed = parseUnits(amount, 6);

  // STEP 4: Fund from control wallet
  const controlAccount = privateKeyToAccount(
    AGENT_CONTROL_WALLET_KEY as `0x${string}`
  );

  const controlWallet = createWalletClient({
    account: controlAccount,
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });

  const txHash = await controlWallet.writeContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: usdcAbi,
    functionName: "transfer",
    args: [account.address, amountParsed],
  });

  // Wait for funding tx to be confirmed on-chain
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  console.log(`[ephemeral] 🆕 wallet created: ${account.address}`);
  console.log(`[ephemeral] 💰 funded: ${amount} USDC`);
  console.log(
    `[ephemeral] 🔗 funding tx: https://sepolia.basescan.org/tx/${txHash}`
  );

  // STEP 5: Return wallet with destroy capability
  return {
    account,
    address: account.address,
    fundedAmount: amount,
    destroy() {
      privateKey = "" as `0x${string}`;
      console.log(`[ephemeral] 🔥 wallet destroyed: ${account.address}`);
    },
  };
}
