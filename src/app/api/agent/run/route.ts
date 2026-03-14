// src/app/api/agent/run/route.ts
import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent/runAgent";
import type { TripPolicy } from "@/lib/agent/runAgent";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Construct a fully typed TripPolicy including passenger identity
  const policy: TripPolicy = {
    from: body.from,
    to: body.to,
    maxFare: body.maxFare,
    budget: body.budget,
    autoBook: body.autoBook,
    passenger: {
      name: body.passenger?.name ?? "",
      email: body.passenger?.email ?? "",
    },
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await runAgent(policy, (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
