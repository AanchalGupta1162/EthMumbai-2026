// src/app/api/privacy-trace/route.ts
import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent/runAgent";
import type { TripPolicy } from "@/lib/agent/runAgent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const policy: TripPolicy = {
      from: body.from ?? "BOM",
      to: body.to ?? "BLR",
      maxFare: body.maxFare ?? 4500,
      budget: body.budget ?? 10000,
      autoBook: body.autoBook ?? true,
      passenger: {
        name: body.passenger?.name ?? "Anonymous",
        email: body.passenger?.email ?? "anonymous@cloak402.dev",
      },
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await runAgent(policy, (event) => {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          });
        } catch (err: any) {
          const errorEvent = {
            type: "agent_error",
            message: err.message || String(err),
            timestamp: Date.now(),
          };
          const data = `data: ${JSON.stringify(errorEvent)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } finally {
          controller.close();
        }
      },
      cancel() {
        console.log("[privacy-trace] 🛑 client disconnected from SSE");
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
