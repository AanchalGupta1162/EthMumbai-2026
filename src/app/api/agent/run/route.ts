// src/app/api/agent/run/route.ts
import { NextRequest } from "next/server";
import { startOpenClawAgent } from "@/lib/agent/openclawBridge";
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

  // Build user message for the LLM agent
  const userMessage =
    body.message ??
    `Find me the cheapest flight from ${policy.from} to ${policy.to} under ₹${policy.maxFare}. ${
      policy.autoBook
        ? "Auto-book if it meets policy."
        : "Show me options, do not book without my confirmation."
    }`;

  // Use OpenClaw agent by default; fall back to static agent if USE_STATIC_AGENT is set
  const useStaticAgent = process.env.USE_STATIC_AGENT === "true";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: unknown) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        if (useStaticAgent) {
          await runAgent(policy, emit);
        } else {
          await startOpenClawAgent(policy, userMessage, emit);
        }
      } catch (err) {
        emit({
          type: "agent_done",
          data: { spent: 0, error: err instanceof Error ? err.message : "Unknown error" },
        });
      }

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
