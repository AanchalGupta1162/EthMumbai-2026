// src/app/api/chat/route.ts
//
// Conversational chat endpoint for the OpenClaw agent.
// Accepts a free-text message + optional policy, streams SSE events back.
// This is the foundation for both the web chat UI and messaging platform webhooks.

import { NextRequest } from "next/server";
import { startOpenClawAgent } from "@/lib/agent/openclawBridge";
import type { TripPolicy } from "@/lib/agent/runAgent";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const message: string = body.message ?? "";
  if (!message.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Policy can be provided explicitly or defaults to a permissive search
  const policy: TripPolicy = {
    from: body.policy?.from ?? "",
    to: body.policy?.to ?? "",
    maxFare: body.policy?.maxFare ?? 99999,
    budget: body.policy?.budget ?? 1,
    autoBook: body.policy?.autoBook ?? false,
    passenger: {
      name: body.policy?.passenger?.name ?? "",
      email: body.policy?.passenger?.email ?? "",
    },
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await startOpenClawAgent(policy, message, (event) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        });
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "agent_done",
              data: { spent: 0, error: err instanceof Error ? err.message : "Unknown error" },
            })}\n\n`
          )
        );
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
