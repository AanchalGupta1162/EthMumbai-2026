// src/lib/wallets/ephemeral.ts
//
// Single-use ephemeral wallet factory.
// Phase 0: direct funding from AGENT_CONTROL_WALLET_KEY
// Phase 1: pool funding via CloakPool relayer (breaks onchain linkability)

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { randomBytes } from "crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
} from "viem";
import { baseSepolia } from "viem/chains";
import { signWithdrawalAuthorization } from "../pool/cloakPool";

// ── Env (read lazily — not all are needed in every mode) ────────────────
const BASE_SEPOLIA_RPC =
  process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const USDC_ADDRESS = process.env.USDC_ADDRESS as `0x${string}`;

// Minimal USDC ABI
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
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ── Exported types ──────────────────────────────────────────────────────

export type FundingMode = "direct" | "pool";

export interface PoolFundingOptions {
  depositorPrivateKey: `0x${string}`;
  depositorAddress: `0x${string}`;
  relayerUrl: string;
}

export interface DirectFundingOptions {
  controlWalletKey: `0x${string}`;
}

export interface EphemeralWalletOptions {
  fundingMinUsdc?: string;
  fundingMaxUsdc?: string;
  fundingMode: FundingMode;
  poolFunding?: PoolFundingOptions;
  directFunding?: DirectFundingOptions;
}

export type EphemeralWallet = {
  account: ReturnType<typeof privateKeyToAccount>;
  address: string;
  fundedAmount: string;
  lastTxHash: string;
  fundingMode: FundingMode;
  destroy: () => void;
};

// ── Shared helper ───────────────────────────────────────────────────────

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
}

function randomizeAmount(minUsdc: string, maxUsdc: string): string {
  const min = parseFloat(minUsdc);
  const max = parseFloat(maxUsdc);
  return (Math.random() * (max - min) + min).toFixed(4);
}

// ── Main factory ────────────────────────────────────────────────────────

export async function createEphemeralWallet(
  opts: EphemeralWalletOptions
): Promise<EphemeralWallet> {
  // STEP 1: Generate a fresh private key entirely in memory
  let privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  // STEP 2: Randomize funding amount
  const amount = randomizeAmount(
    opts.fundingMinUsdc ?? "0.03",
    opts.fundingMaxUsdc ?? "0.09"
  );

  // STEP 3: Fund based on mode
  let txHash: string;

  if (opts.fundingMode === "pool" && opts.poolFunding) {
    txHash = await fundViaPool(
      account.address as `0x${string}`,
      amount,
      opts.poolFunding
    );
  } else {
    const controlKey =
      opts.directFunding?.controlWalletKey ??
      (process.env.AGENT_CONTROL_WALLET_KEY as `0x${string}`);
    txHash = await fundDirect(account.address as `0x${string}`, amount, controlKey);
  }

  console.log(`[ephemeral] 🆕 wallet created: ${account.address}`);
  console.log(`[ephemeral] 💰 funded: ${amount} USDC (mode: ${opts.fundingMode})`);
  console.log(
    `[ephemeral] 🔗 funding tx: https://sepolia.basescan.org/tx/${txHash}`
  );

  return {
    account,
    address: account.address,
    fundedAmount: amount,
    lastTxHash: txHash,
    fundingMode: opts.fundingMode,
    destroy() {
      privateKey = "" as `0x${string}`;
      console.log(`[ephemeral] 🔥 wallet destroyed: ${account.address}`);
    },
  };
}

// ── Direct funding (Phase 0) ────────────────────────────────────────────

async function fundDirect(
  ephemeralAddress: `0x${string}`,
  amountUsdc: string,
  controlWalletKey: `0x${string}`
): Promise<string> {
  const controlAccount = privateKeyToAccount(controlWalletKey);
  const controlWallet = createWalletClient({
    account: controlAccount,
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
  const publicClient = getPublicClient();
  const amountParsed = parseUnits(amountUsdc, 6);

  const txHash = await controlWallet.writeContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "transfer",
    args: [ephemeralAddress, amountParsed],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// ── Pool funding (Phase 1) ──────────────────────────────────────────────

async function fundViaPool(
  ephemeralAddress: `0x${string}`,
  amountUsdc: string,
  poolOpts: PoolFundingOptions
): Promise<string> {
  // 1. Generate random nonce
  const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

  // 2. Sign withdrawal authorization off-chain
  const signature = await signWithdrawalAuthorization(
    poolOpts.depositorPrivateKey,
    {
      depositorAddress: poolOpts.depositorAddress,
      ephemeralAddress,
      amountUsdc,
      nonce,
    }
  );

  // 3. POST to relayer
  const response = await fetch(`${poolOpts.relayerUrl}/request-funding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      depositorAddress: poolOpts.depositorAddress,
      ephemeralAddress,
      amountUsdc,
      nonce,
      signature,
    }),
  });

  const result = (await response.json()) as {
    success: boolean;
    txHash?: string;
    error?: string;
  };

  if (!result.success) {
    throw new Error(`Relayer funding failed: ${result.error}`);
  }

  // 4. Poll for USDC balance on the ephemeral address
  const publicClient = getPublicClient();
  const amountParsed = parseUnits(amountUsdc, 6);
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [ephemeralAddress],
    });
    if (balance >= amountParsed) {
      return result.txHash as string;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error("Ephemeral wallet funding timeout after 30s");
}

// ── Legacy wrapper (Phase 0 backward compat) ────────────────────────────

export async function createEphemeralWalletDirect(opts?: {
  fundingMinUsdc?: string;
  fundingMaxUsdc?: string;
}): Promise<EphemeralWallet> {
  return createEphemeralWallet({
    fundingMinUsdc: opts?.fundingMinUsdc,
    fundingMaxUsdc: opts?.fundingMaxUsdc,
    fundingMode: "direct",
    directFunding: {
      controlWalletKey: process.env.AGENT_CONTROL_WALLET_KEY as `0x${string}`,
    },
  });
}
