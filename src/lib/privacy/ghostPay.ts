// src/lib/privacy/ghostPay.ts
import { createEphemeralWallet } from '../wallets/ephemeral'
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'
import { baseSepolia } from 'viem/chains'

type PrivacyEvent = {
  type: 'wallet_created' | 'delay_applied' | 'payment_sent' | 'data_received' | 'wallet_destroyed'
  callId: number
  data: Record<string, any>
}

export async function ghostPay(
  url: string,
  body: Record<string, any>,
  callId: number,
  onEvent: (e: PrivacyEvent) => void
) {
  // Privacy measure 1: Random delay (kills timing correlation)
  const delayMs = Math.floor(Math.random() * 4000 + 1500)
  onEvent({ type: 'delay_applied', callId, data: { ms: delayMs } })
  await new Promise(r => setTimeout(r, delayMs))

  // Privacy measure 2: Fresh wallet per call
  const wallet = await createEphemeralWallet()
  onEvent({ type: 'wallet_created', callId, data: { address: wallet.address, amount: wallet.fundedAmount } })

  try {
    // Step 1: hit endpoint, expect 402
    const firstRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (firstRes.status !== 402) throw new Error(`Expected 402, got ${firstRes.status}`)
    const paymentRequest = await firstRes.json()

    // Step 2: pay from ephemeral wallet
    const walletClient = createWalletClient({
      account: wallet.account,
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC)
    })
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC)
    })

    const usdcAbi = [{
      name: 'transfer', type: 'function',
      inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
      outputs: [{ type: 'bool' }], stateMutability: 'nonpayable'
    }] as const

    const txHash = await walletClient.writeContract({
      address: process.env.USDC_ADDRESS as `0x${string}`,
      abi: usdcAbi,
      functionName: 'transfer',
      args: [paymentRequest.accepts[0].payTo, BigInt(paymentRequest.accepts[0].maxAmountRequired)]
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })
    onEvent({ type: 'payment_sent', callId, data: {
      txHash,
      scanUrl: `https://sepolia.basescan.org/tx/${txHash}`
    }})

    // Step 3: retry with payment proof
    const dataRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': txHash
      },
      body: JSON.stringify(body)
    })

    const data = await dataRes.json()
    onEvent({ type: 'data_received', callId, data: {} })
    return data

  } finally {
    wallet.destroy()
    onEvent({ type: 'wallet_destroyed', callId, data: { address: wallet.address } })
  }
}
