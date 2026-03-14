// src/lib/wallets/ephemeral.ts
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'
import { baseSepolia } from 'viem/chains'

export async function createEphemeralWallet() {
  // Generate in-memory — no third party, no logs
  let privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  // Randomised funding amount (prevents amount fingerprinting)
  const amount = (Math.random() * 0.06 + 0.03).toFixed(4)

  // Fund from control wallet
  const controlWallet = createWalletClient({
    account: privateKeyToAccount(process.env.AGENT_CONTROL_WALLET_KEY as `0x${string}`),
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC)
  })

  const usdcAbi = [{
    name: 'transfer', type: 'function',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }], stateMutability: 'nonpayable'
  }] as const

  await controlWallet.writeContract({
    address: process.env.USDC_ADDRESS as `0x${string}`,
    abi: usdcAbi,
    functionName: 'transfer',
    args: [account.address, parseUnits(amount, 6)]
  })

  return {
    account,
    address: account.address,
    fundedAmount: amount,
    destroy() { privateKey = '' as any }
  }
}
