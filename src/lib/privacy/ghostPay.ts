// src/lib/privacy/ghostPay.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createEphemeralWallet } from "../wallets/ephemeral";
import type { EphemeralWallet, FundingMode } from "../wallets/ephemeral";
import { resolveParamsForPath } from "../config/privacyConfig";
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

// Phase 1: CloakPool funding mode
const FUNDING_MODE = (process.env.FUNDING_MODE ?? "direct") as FundingMode;
const DEPOSITOR_PRIVATE_KEY = process.env.DEPOSITOR_PRIVATE_KEY as `0x${string}` | undefined;
const DEPOSITOR_ADDRESS = process.env.DEPOSITOR_ADDRESS as `0x${string}` | undefined;
const RELAYER_URL = process.env.RELAYER_URL ?? "http://localhost:4022";

// ── Exported types ──────────────────────────────────────────────────────
export type PrivacyEvent =
  | {
      type: "delay_applied";
      callId: number;
      path: string;
      delayMs: number;
      config: { delayMinMs: number; delayMaxMs: number; fundingMinUsdc: string; fundingMaxUsdc: string };
      timestamp: number;
    }
  | {
      type: "wallet_created";
      callId: number;
      path: string;
      ephemeralAddress: string;
      fundingAmountUsdc: string;
      fundingTxHash: string;
      fundingMode: FundingMode;
      timestamp: number;
    }
  | {
      type: "payment_sent";
      callId: number;
      path: string;
      ephemeralAddress: string;
      settleTxHash: string;
      amountPaidUsdc: string;
      sellerUrl: string;
      timestamp: number;
    }
  | {
      type: "data_received";
      callId: number;
      path: string;
      ephemeralAddress: string;
      responseStatus: number;
      timestamp: number;
    }
  | {
      type: "wallet_destroyed";
      callId: number;
      path: string;
      ephemeralAddress: string;
      success: boolean;
      timestamp: number;
    }
  | {
      type: "error";
      callId: number;
      path: string;
      ephemeralAddress: string | null;
      errorMessage: string;
      stage: "delay" | "funding" | "payment" | "response" | "cleanup";
      timestamp: number;
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
  let ephemeralAddress: string | null = null;
  let stage: "delay" | "funding" | "payment" | "response" | "cleanup" = "delay";
  let wallet: EphemeralWallet | null = null;

  const params = resolveParamsForPath(path);

  try {
    // STEP 1: Random delay
    const delayMs = Math.floor(
      Math.random() * (params.delayMaxMs - params.delayMinMs) + params.delayMinMs
    );
    onEvent?.({
      type: "delay_applied",
      callId: currentCallId,
      path,
      delayMs,
      config: params,
      timestamp: Date.now(),
    });
    await new Promise((r) => setTimeout(r, delayMs));

    // STEP 2: Create ephemeral wallet
    stage = "funding";
    wallet = await createEphemeralWallet(
      FUNDING_MODE === "pool" && DEPOSITOR_PRIVATE_KEY && DEPOSITOR_ADDRESS
        ? {
            fundingMinUsdc: params.fundingMinUsdc,
            fundingMaxUsdc: params.fundingMaxUsdc,
            fundingMode: "pool",
            poolFunding: {
              depositorPrivateKey: DEPOSITOR_PRIVATE_KEY,
              depositorAddress: DEPOSITOR_ADDRESS,
              relayerUrl: RELAYER_URL,
            },
          }
        : {
            fundingMinUsdc: params.fundingMinUsdc,
            fundingMaxUsdc: params.fundingMaxUsdc,
            fundingMode: "direct",
            directFunding: {
              controlWalletKey: process.env.AGENT_CONTROL_WALLET_KEY as `0x${string}`,
            },
          }
    );
    ephemeralAddress = wallet.address;
    
    onEvent?.({
      type: "wallet_created",
      callId: currentCallId,
      path,
      ephemeralAddress: wallet.address,
      fundingAmountUsdc: wallet.fundedAmount,
      fundingTxHash: wallet.lastTxHash,
      fundingMode: wallet.fundingMode,
      timestamp: Date.now(),
    });

    // STEP 3: Build x402 client
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC),
    });
    const signer = toClientEvmSigner(wallet.account, publicClient);
    const client = new x402Client();
    registerExactEvmScheme(client, { signer });
    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const httpClient = new x402HTTPClient(client);

    // STEP 4: Make the paid request
    stage = "payment";
    const url = `${AIRLINE_API_URL}${path}`;
    console.log(`[ghostPay] 📡 calling ${url} (call #${currentCallId})`);

    const response = await fetchWithPayment(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // STEP 5: SettleResponse
    stage = "response";
    let settleTxHash = "";
    let amountPaidUsdc = "0.00"; // Ideally this comes from the protocol, but we'll approximate/hardcode based on endpoint for UI realism

    if (response.ok) {
      const settlement = httpClient.getPaymentSettleResponse((name) =>
        response.headers.get(name)
      );
      settleTxHash = settlement?.transaction ?? "";
      amountPaidUsdc = path.includes("book") ? "0.005" : "0.001";
    }

    onEvent?.({
      type: "payment_sent",
      callId: currentCallId,
      path,
      ephemeralAddress: ephemeralAddress as string,
      settleTxHash,
      amountPaidUsdc,
      sellerUrl: url,
      timestamp: Date.now(),
    });
    console.log(`[ghostPay] ✅ payment tx: ${settleTxHash || "n/a"}`);

    // STEP 6: Return data
    const data = (await response.json()) as T;
    onEvent?.({
      type: "data_received",
      callId: currentCallId,
      path,
      ephemeralAddress: ephemeralAddress as string,
      responseStatus: response.status,
      timestamp: Date.now(),
    });

    return data;
  } catch (err: any) {
    onEvent?.({
      type: "error",
      callId: currentCallId,
      path,
      ephemeralAddress,
      errorMessage: err.message ?? String(err),
      stage,
      timestamp: Date.now(),
    });
    throw err;
  } finally {
    // STEP 7: Destroy
    stage = "cleanup";
    let success = false;
    if (wallet) {
      try {
        wallet.destroy();
        success = true;
      } catch {
        success = false;
      }
      onEvent?.({
        type: "wallet_destroyed",
        callId: currentCallId,
        path,
        ephemeralAddress: wallet.address,
        success,
        timestamp: Date.now(),
      });
    }
  }
}
