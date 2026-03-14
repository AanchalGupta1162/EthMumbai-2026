// src/lib/relayer/relayerServer.ts
//
// Standalone Express server that acts as the on-chain relayer for CloakPool.
// It receives signed withdrawal authorizations from the agent and submits
// them on-chain, paying gas itself. This breaks the depositor↔ephemeral link.
//
// Run separately: npx tsx src/lib/relayer/relayerServer.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import express from "express";
import cors from "cors";
import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
} from "viem";
import { baseSepolia } from "viem/chains";
import { CLOAK_POOL_ABI, getPoolBalance } from "../pool/cloakPool";

// ── Env guards ──────────────────────────────────────────────────────────
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as
  | `0x${string}`
  | undefined;
if (!RELAYER_PRIVATE_KEY)
  throw new Error("RELAYER_PRIVATE_KEY is missing in .env.local");

const CLOAK_POOL_ADDRESS = process.env.CLOAK_POOL_ADDRESS as
  | `0x${string}`
  | undefined;
if (!CLOAK_POOL_ADDRESS)
  throw new Error("CLOAK_POOL_ADDRESS is missing in .env.local");

const BASE_SEPOLIA_RPC =
  process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const RELAYER_MIN_USDC = parseFloat(process.env.RELAYER_MIN_USDC ?? "0.01");
const RELAYER_MAX_USDC = parseFloat(process.env.RELAYER_MAX_USDC ?? "0.20");

// ── Rate limiter (manual, in-memory) ────────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 10;
const rateLimitMap = new Map<
  string,
  { count: number; windowStart: number }
>();

function checkRateLimit(depositorAddress: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(depositorAddress);
  if (!entry || now > entry.windowStart + RATE_WINDOW_MS) {
    rateLimitMap.set(depositorAddress, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

// ── Helpers ─────────────────────────────────────────────────────────────
function ts(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function truncate(s: string, len = 13): string {
  if (s.length <= len) return s;
  return s.slice(0, 10) + "...";
}

// ── Express app ─────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── POST /request-funding ───────────────────────────────────────────────
interface FundingRequest {
  depositorAddress: string;
  ephemeralAddress: string;
  amountUsdc: string;
  nonce: string;
  signature: string;
}

app.post("/request-funding", async (req, res) => {
  const body = req.body as FundingRequest;
  const {
    depositorAddress,
    ephemeralAddress,
    amountUsdc,
    nonce,
    signature,
  } = body;

  // 1. Validate field presence
  if (
    !depositorAddress ||
    !ephemeralAddress ||
    !amountUsdc ||
    !nonce ||
    !signature
  ) {
    console.log(
      `[${ts()}] POST /request-funding | ERROR: missing required fields`
    );
    return res
      .status(400)
      .json({ success: false, error: "all fields are required" });
  }

  // 2. Validate address format
  const addrRegex = /^0x[0-9a-fA-F]{40}$/;
  if (!addrRegex.test(depositorAddress) || !addrRegex.test(ephemeralAddress)) {
    return res
      .status(400)
      .json({ success: false, error: "invalid address format" });
  }

  // 3. Validate nonce format
  if (!/^0x[0-9a-fA-F]{64}$/.test(nonce)) {
    return res
      .status(400)
      .json({ success: false, error: "invalid nonce format" });
  }

  // 4. Validate signature format
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) {
    return res
      .status(400)
      .json({ success: false, error: "invalid signature format" });
  }

  // 5. Validate amount
  const amount = parseFloat(amountUsdc);
  if (isNaN(amount) || amount < RELAYER_MIN_USDC || amount > RELAYER_MAX_USDC) {
    return res.status(400).json({
      success: false,
      error: `amount must be between ${RELAYER_MIN_USDC} and ${RELAYER_MAX_USDC} USDC`,
    });
  }

  // 6. Rate limit
  if (!checkRateLimit(depositorAddress)) {
    console.log(
      `[${ts()}] POST /request-funding | depositor: ${truncate(depositorAddress)} | outcome: rate limited`
    );
    return res
      .status(429)
      .json({ success: false, error: "rate limit exceeded" });
  }

  try {
    // 7. Check on-chain balance
    const balance = await getPoolBalance(
      CLOAK_POOL_ADDRESS!,
      depositorAddress as `0x${string}`
    );
    if (parseFloat(balance) < amount) {
      console.log(
        `[${ts()}] POST /request-funding | depositor: ${truncate(depositorAddress)} | amount: ${amountUsdc} USDC | outcome: insufficient balance (${balance})`
      );
      return res
        .status(400)
        .json({ success: false, error: "insufficient pool balance" });
    }

    // 8. Submit withdrawal on-chain
    const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY!);
    const walletClient = createWalletClient({
      account: relayerAccount,
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC),
    });
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC),
    });

    const amountParsed = parseUnits(amountUsdc, 6);

    const txHash = await walletClient.writeContract({
      address: CLOAK_POOL_ADDRESS!,
      abi: CLOAK_POOL_ABI,
      functionName: "withdraw",
      args: [
        depositorAddress as `0x${string}`,
        ephemeralAddress as `0x${string}`,
        amountParsed,
        nonce as `0x${string}`,
        signature as `0x${string}`,
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(
      `[${ts()}] POST /request-funding | depositor: ${truncate(depositorAddress)} | amount: ${amountUsdc} USDC | outcome: funded | tx: ${truncate(txHash)}`
    );

    return res.json({
      success: true,
      txHash,
      fundedAddress: ephemeralAddress,
      amountUsdc,
    });
  } catch (err: any) {
    console.log(
      `[${ts()}] POST /request-funding | depositor: ${truncate(depositorAddress)} | amount: ${amountUsdc} USDC | outcome: error | ${err.message?.slice(0, 80)}`
    );
    return res
      .status(500)
      .json({ success: false, error: err.message ?? "internal error" });
  }
});

// ── GET /pool-status ────────────────────────────────────────────────────
app.get("/pool-status", (_req, res) => {
  const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY!);
  res.json({
    poolAddress: CLOAK_POOL_ADDRESS,
    relayerAddress: relayerAccount.address,
    network: "base-sepolia",
    minAllowedUsdc: String(RELAYER_MIN_USDC),
    maxAllowedUsdc: String(RELAYER_MAX_USDC),
  });
});

// ── Start ───────────────────────────────────────────────────────────────
const PORT = process.env.RELAYER_PORT ?? 4022;
app.listen(PORT, () => {
  const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY!);
  console.log(`CloakPool Relayer running on port ${PORT}`);
  console.log(`Relayer address: ${relayerAccount.address}`);
  console.log(`Pool address: ${CLOAK_POOL_ADDRESS}`);
  console.log(
    `Allowed USDC range: ${RELAYER_MIN_USDC} - ${RELAYER_MAX_USDC}`
  );
});
