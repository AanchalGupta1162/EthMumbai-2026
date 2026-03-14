// src/lib/pool/cloakPool.ts
//
// Pure TypeScript client for the deployed CloakPool contract on Base Sepolia.
// No server code — just contract reads, writes, and off-chain signing.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  keccak256,
  encodePacked,
} from "viem";
import { baseSepolia } from "viem/chains";

// ── Environment ─────────────────────────────────────────────────────────
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const USDC_ADDRESS = process.env.USDC_ADDRESS as `0x${string}`;

// ── ABI ─────────────────────────────────────────────────────────────────
import type { Abi } from "viem";
import CLOAK_POOL_ABI_RAW from "../abi/CloakPool.json";
export const CLOAK_POOL_ABI = CLOAK_POOL_ABI_RAW as unknown as Abi;

// Minimal ERC20 ABI for approve + balanceOf
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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

// ── Types ───────────────────────────────────────────────────────────────

export interface WithdrawalRequest {
  depositorAddress: `0x${string}`;
  ephemeralAddress: `0x${string}`;
  amountUsdc: string;
  nonce: `0x${string}`;
}

export interface WithdrawalResult {
  txHash: `0x${string}`;
  ephemeralAddress: `0x${string}`;
  amountFunded: string;
}

export interface PoolStats {
  totalDeposited: string;
  totalWithdrawn: string;
  currentHoldings: string;
  depositorBalance: string;
}

// ── Shared clients ──────────────────────────────────────────────────────

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
}

// ── Functions ───────────────────────────────────────────────────────────

/**
 * Signs a withdrawal authorization off-chain using EIP-191 personal sign.
 * The depositor signs, the relayer submits — breaking the onchain link.
 */
export async function signWithdrawalAuthorization(
  depositorPrivateKey: `0x${string}`,
  request: WithdrawalRequest
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(depositorPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });

  const messageHash = keccak256(
    encodePacked(
      ["string", "address", "uint256", "bytes32", "uint256"],
      [
        "CloakPool withdrawal: ",
        request.ephemeralAddress,
        parseUnits(request.amountUsdc, 6),
        request.nonce,
        BigInt(84532),
      ]
    )
  );

  const signature = await walletClient.signMessage({
    message: { raw: messageHash },
  });

  return signature;
}

/**
 * Reads the depositor's balance inside the CloakPool contract.
 */
export async function getPoolBalance(
  poolAddress: `0x${string}`,
  depositorAddress: `0x${string}`
): Promise<string> {
  const publicClient = getPublicClient();
  const balance = (await publicClient.readContract({
    address: poolAddress,
    abi: CLOAK_POOL_ABI,
    functionName: "getBalance",
    args: [depositorAddress],
  })) as bigint;
  return formatUnits(balance, 6);
}

/**
 * Returns aggregate pool statistics plus the depositor's balance.
 */
export async function getPoolStats(
  poolAddress: `0x${string}`,
  depositorAddress: `0x${string}`
): Promise<PoolStats> {
  const publicClient = getPublicClient();

  const [totalDeposited, totalWithdrawn, currentHoldings] =
    (await publicClient.readContract({
      address: poolAddress,
      abi: CLOAK_POOL_ABI,
      functionName: "getStats",
    })) as [bigint, bigint, bigint];

  const depositorBalance = (await publicClient.readContract({
    address: poolAddress,
    abi: CLOAK_POOL_ABI,
    functionName: "getBalance",
    args: [depositorAddress],
  })) as bigint;

  return {
    totalDeposited: formatUnits(totalDeposited, 6),
    totalWithdrawn: formatUnits(totalWithdrawn, 6),
    currentHoldings: formatUnits(currentHoldings, 6),
    depositorBalance: formatUnits(depositorBalance, 6),
  };
}

/**
 * Deposits USDC into the CloakPool. Handles ERC20 approve → deposit flow.
 */
export async function depositToPool(
  depositorPrivateKey: `0x${string}`,
  poolAddress: `0x${string}`,
  amountUsdc: string
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(depositorPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
  const publicClient = getPublicClient();
  const amount = parseUnits(amountUsdc, 6);

  // Step 1: Approve USDC
  const approveHash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [poolAddress, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Step 2: Deposit into pool
  const depositHash = await walletClient.writeContract({
    address: poolAddress,
    abi: CLOAK_POOL_ABI,
    functionName: "deposit",
    args: [amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });

  return depositHash;
}

export { ERC20_ABI };
