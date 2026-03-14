import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const app = express();
app.use(express.json());

const payTo = process.env.PAY_TO_ADDRESS!;
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
});

const server = new x402ResourceServer(facilitatorClient).register(
  "eip155:84532",
  new ExactEvmScheme()
);

app.use(
  paymentMiddleware(
    {
      "POST /search-flights": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:84532",
            payTo,
          },
        ],
        description: "Search flight fares",
        mimeType: "application/json",
      },
      "POST /book-flight": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.005",
            network: "eip155:84532",
            payTo,
          },
        ],
        description: "Book a selected flight",
        mimeType: "application/json",
      },
    },
    server
  )
);

const FLIGHTS = [
  { id: "F001", airline: "IndiGo", from: "BOM", to: "BLR", fare: 4200, date: "2026-03-20" },
  { id: "F002", airline: "Air India", from: "BOM", to: "BLR", fare: 5100, date: "2026-03-20" },
  { id: "F003", airline: "SpiceJet", from: "BOM", to: "BLR", fare: 3800, date: "2026-03-21" },
];

app.post("/search-flights", (req, res) => {
  const { from, to, maxFare } = req.body;
  const results = FLIGHTS.filter(
    (f) => f.from === from && f.to === to && f.fare <= (maxFare || 99999)
  );
  res.json({ flights: results, searchedAt: Date.now() });
});

app.post("/book-flight", (req, res) => {
  const { flightId, passenger } = req.body;

  // Validate passenger identity
  if (!passenger?.name || !passenger?.email) {
    return res.status(400).json({ error: "passenger.name and passenger.email are required" });
  }

  const flight = FLIGHTS.find((f) => f.id === flightId);
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const ticketNumber = `TKT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  res.json({
    bookingId: `BK${Date.now()}`,
    ticketNumber,
    flight,
    passenger: { name: passenger.name, email: passenger.email },
    status: "CONFIRMED",
    bookedAt: Date.now(),
  });
});

app.listen(4021, () => {
  console.log("Server listening at http://localhost:4021");
});
