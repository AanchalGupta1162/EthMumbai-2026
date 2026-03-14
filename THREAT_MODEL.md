# Cloak402 Threat Model (v0)

Cloak402 is an autonomous, privacy-first travel agent. This document outlines the explicit privacy guarantees, known limitations of the current architecture (Phase 0), and the intended upgrade path to solve them.

## What Cloak402 Protects (v0)

1. **Single-use Ephemeral Wallets:** A new throwaway keypair is generated in-memory for *every single API call* (e.g., flight search, booking). There is no persistent onchain identity reused across calls.
2. **Randomized USDC Funding:** Wallets are funded with a randomized band of USDC (e.g., 0.03 to 0.09 USDC). This breaks naive amount-clustering heuristics (e.g., looking for exactly 0.001 USDC transactions).
3. **Randomized Timing Delays:** A random delay (e.g., 1500ms to 6000ms) is applied before every action. This reduces timestamp correlation between HTTP requests hitting the seller server and the incoming onchain settlements.
4. **Private Key Destruction:** After an API call completes (or fails), the ephemeral private key is immediately overwritten in memory, neutralizing the risk of key reuse even if the agent host is subsequently compromised.

## What Cloak402 Does NOT Protect (v0 Known Limitations)

The current Phase 0 architecture relies on a direct-funding model which leaves severe privacy holes against a sophisticated observer:

1. **Funding Wallet Linkability:** ALL ephemeral wallets are funded directly from `AGENT_CONTROL_WALLET_KEY`, which is a single persistent onchain identity. A trivial graph analysis rule ("addresses that only ever receive from 0xX and then pay a known x402 seller") trivially clusters all agent activity back to one user.
2. **IP Address and HTTP Metadata:** The seller server sees the originating IP and user agent of the agent host regardless of ephemeral wallet usage.
3. **Request Payload Contents:** The JSON body of `/search-flights` and `/book-flight` calls inherently contains user-identifying or highly specific behavioral data (destinations, dates, passenger names for booking).
4. **No Anonymity Set:** There is no shared pool or batching layer. Each ephemeral wallet is privately identifiable as belonging to the control wallet simply by following the USDC transfer chain.

---

## Intended Upgrade Path

To address the limitations above, Cloak402 will evolve through the following phases:

### Phase 1: CloakPool (Breaking Linkability)
Introduce a shared USDC pool contract on Base. Users deposit into the pool. Instead of the control wallet funding ephemerals directly, ephemerals are funded "just in time" via anonymous withdrawals from the pool (e.g., using a relayer or stealth address pattern). This breaks the one-hop graph link.

### Phase 2: Disclosure Policies (Payload Protection)
Add strict, per-domain data disclosure rules enforced inside the `ghostPay` wrapper. The agent will refuse to send PII (like passenger names) to endpoints that are only authorized for anonymous search data.

### Phase 3: ZK Authorization (Compliance & Sybil Resistance)
Integrate Zero-Knowledge proofs (e.g., via Self Protocol) so the agent can prove to the seller that the user meets compliance requirements (AML/KYC, humanhood) without revealing their actual identity.
