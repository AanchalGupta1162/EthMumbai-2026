// airline-api/server.ts
import express from 'express'
import { paymentMiddleware, Network } from '@x402/express'
import { ExactEvmScheme } from '@x402/evm'
import { HTTPFacilitatorClient } from '@x402/core/server'
import 'dotenv/config'

const app = express()
app.use(express.json())

const facilitator = new HTTPFacilitatorClient(process.env.FACILITATOR_URL!)

// Register Base Sepolia x402 scheme
const network: Network = {
  facilitator,
  schemes: { exact: new ExactEvmScheme() }
}

// Middleware factory — protect any route
const payment = paymentMiddleware(
  process.env.PAY_TO_ADDRESS!,
  {
    '/search-flights': { amount: 1000, asset: 'USDC', network: process.env.NETWORK! },
    '/book-flight':    { amount: 5000, asset: 'USDC', network: process.env.NETWORK! }
  },
  network
)

app.use(payment)

// Mock flight data
const FLIGHTS = [
  { id: 'F001', airline: 'IndiGo',    from: 'BOM', to: 'BLR', fare: 4200, date: '2026-03-20' },
  { id: 'F002', airline: 'Air India', from: 'BOM', to: 'BLR', fare: 5100, date: '2026-03-20' },
  { id: 'F003', airline: 'SpiceJet',  from: 'BOM', to: 'BLR', fare: 3800, date: '2026-03-21' },
]

app.post('/search-flights', (req, res) => {
  const { from, to, maxFare } = req.body
  const results = FLIGHTS.filter(f =>
    f.from === from && f.to === to && f.fare <= (maxFare || 99999)
  )
  res.json({ flights: results, searchedAt: Date.now() })
})

app.post('/book-flight', (req, res) => {
  const { flightId } = req.body
  const flight = FLIGHTS.find(f => f.id === flightId)
  if (!flight) return res.status(404).json({ error: 'Flight not found' })
  res.json({
    bookingId: `BK${Date.now()}`,
    flight,
    status: 'CONFIRMED',
    bookedAt: Date.now()
  })
})

app.listen(4021, () => console.log('✈️  Airline API on :4021'))
