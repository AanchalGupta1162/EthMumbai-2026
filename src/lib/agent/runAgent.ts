// src/lib/agent/runAgent.ts
import { ghostPay } from '../privacy/ghostPay'

type TripPolicy = {
  from: string
  to: string
  maxFare: number
  budget: number
  autoBook: boolean
}

type AgentEvent = {
  type: string
  data: Record<string, any>
}

export async function runAgent(
  policy: TripPolicy,
  onEvent: (e: AgentEvent) => void
) {
  const AIRLINE_URL = process.env.NEXT_PUBLIC_AIRLINE_API_URL!
  let spent = 0
  let callId = 1

  onEvent({ type: 'agent_start', data: { policy } })

  // Poll 3 times (demo scope — real version would loop on a schedule)
  for (let i = 0; i < 3; i++) {
    if (spent >= policy.budget) {
      onEvent({ type: 'budget_exhausted', data: { spent } })
      break
    }

    onEvent({ type: 'checking_fares', data: { attempt: i + 1 } })

    const result = await ghostPay(
      `${AIRLINE_URL}/search-flights`,
      { from: policy.from, to: policy.to, maxFare: policy.maxFare },
      callId++,
      (e) => onEvent({ type: 'privacy_event', data: e })
    )

    spent += 0.001  // track USDC spent on searches
    const cheapest = result.flights?.sort((a: any, b: any) => a.fare - b.fare)[0]

    if (!cheapest) {
      onEvent({ type: 'no_match', data: { attempt: i + 1 } })
      continue
    }

    onEvent({ type: 'fare_found', data: { flight: cheapest } })

    // Autobook if conditions met
    if (policy.autoBook && cheapest.fare <= policy.maxFare) {
      onEvent({ type: 'booking_triggered', data: { flight: cheapest } })

      const booking = await ghostPay(
        `${AIRLINE_URL}/book-flight`,
        { flightId: cheapest.id },
        callId++,
        (e) => onEvent({ type: 'privacy_event', data: e })
      )

      onEvent({ type: 'booked', data: { booking } })
      break  // done
    }
  }

  onEvent({ type: 'agent_done', data: { spent } })
}
