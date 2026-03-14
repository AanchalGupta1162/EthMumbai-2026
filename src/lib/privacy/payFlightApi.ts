import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";

import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const pk = process.env.EVM_PRIVATE_KEY;
if (!pk) throw new Error("EVM_PRIVATE_KEY is missing in .env.local");

const formattedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
const account = privateKeyToAccount(formattedPk as `0x${string}`);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const signer = toClientEvmSigner(account, publicClient);

const client = new x402Client();
registerExactEvmScheme(client, { signer });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const httpClient = new x402HTTPClient(client);

export async function payFlightApi<T = any>(
  path: string,
  body: Record<string, any>
): Promise<{ data: T; payment?: any }> {
  const baseUrl = process.env.NEXT_PUBLIC_AIRLINE_API_URL!;
  const response = await fetchWithPayment(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  let payment;
  if (response.ok) {
    payment = httpClient.getPaymentSettleResponse((name) =>
      response.headers.get(name)
    );
  }

  return { data, payment };
}
