// src/lib/privacy/ghostPay.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createEphemeralWallet } from "../wallets/ephemeral";
import {
  x402Client,
  wrapFetchWithPayment,
  x402HTTPClient,
} from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// ── Env guards ──────────────────────────────────────────────────────────
const AIRLINE_API_URL = process.env.NEXT_PUBLIC_AIRLINE_API_URL;
if (!AIRLINE_API_URL)
  throw new Error("NEXT_PUBLIC_AIRLINE_API_URL is missing in .env.local");

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC;
if (!BASE_SEPOLIA_RPC)
  throw new Error("BASE_SEPOLIA_RPC is missing in .env.local");

// ── Exported types ──────────────────────────────────────────────────────
export type PrivacyEvent =
  | { type: "delay_applied"; callId: number; data: { ms: number } }
  | {
      type: "wallet_created";
      callId: number;
      data: { address: string; amount: string };
    }
  | {
      type: "payment_sent";
      callId: number;
      data: { txHash: string | undefined; scanUrl: string | undefined };
    }
  | { type: "data_received"; callId: number; data: Record<string, never> }
  | {
      type: "wallet_destroyed";
      callId: number;
      data: { address: string };
    };

// ── Module-level call counter ───────────────────────────────────────────
let nextCallId = 1;

// ── Main function ───────────────────────────────────────────────────────
export async function ghostPay<T = any>(
  path: string,
  body: Record<string, any>,
  onEvent?: (event: PrivacyEvent) => void
): Promise<T> {
  const currentCallId = nextCallId++;

  // STEP 1: Random delay (1500–6000ms) — prevents timing correlation
  const delayMs = Math.floor(Math.random() * 4500 + 1500);
  onEvent?.({
    type: "delay_applied",
    callId: currentCallId,
    data: { ms: delayMs },
  });
  await new Promise((r) => setTimeout(r, delayMs));

  // STEP 2: Create ephemeral wallet (fresh throwaway per call)
  const wallet = await createEphemeralWallet();
  onEvent?.({
    type: "wallet_created",
    callId: currentCallId,
    data: { address: wallet.address, amount: wallet.fundedAmount },
  });

  try {
    // STEP 3: Build x402 client with ephemeral signer
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC),
    });

    const signer = toClientEvmSigner(wallet.account, publicClient);

    const client = new x402Client();
    registerExactEvmScheme(client, { signer });

    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const httpClient = new x402HTTPClient(client);

    // STEP 4: Make the paid request via x402
    const url = `${AIRLINE_API_URL}${path}`;
    console.log(`[ghostPay] 📡 calling ${url} (call #${currentCallId})`);

    const response = await fetchWithPayment(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // STEP 5: Read payment settlement from response headers
    let txHash: string | undefined;
    let scanUrl: string | undefined;
    if (response.ok) {
      const settlement = httpClient.getPaymentSettleResponse((name) =>
        response.headers.get(name)
      );
      txHash = settlement?.transaction;
      scanUrl = txHash
        ? `https://sepolia.basescan.org/tx/${txHash}`
        : undefined;
    }

    onEvent?.({
      type: "payment_sent",
      callId: currentCallId,
      data: { txHash, scanUrl },
    });
    console.log(`[ghostPay] ✅ payment tx: ${scanUrl ?? "n/a"}`);

    // STEP 6: Return data
    const data = (await response.json()) as T;
    onEvent?.({
      type: "data_received",
      callId: currentCallId,
      data: {} as Record<string, never>,
    });

    return data;
  } finally {
    // STEP 7: Destroy wallet — key is wiped even on failure
    wallet.destroy();
    onEvent?.({
      type: "wallet_destroyed",
      callId: currentCallId,
      data: { address: wallet.address },
    });
  }
}
