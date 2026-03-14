// src/lib/agent/openclawBridge.ts
//
// Bridges the OpenClaw agent CLI to the existing AgentEvent/PrivacyEvent
// streaming system. Spawns an OpenClaw agent session, writes the trip policy
// to shared state, and translates output into events the web dashboard
// already understands.

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { TripPolicy, AgentEvent } from "./runAgent";

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const STATE_DIR = path.join(PROJECT_ROOT, ".openclaw", "state");
const POLICY_PATH = path.join(STATE_DIR, "trip_policy.json");

/**
 * Writes the trip policy to the shared state file so that
 * get_trip_policy.ts can read it from the spawned tool process.
 */
function writePolicyState(policy: TripPolicy): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(POLICY_PATH, JSON.stringify(policy, null, 2));
}

/**
 * Cleans up the policy state file after the agent session ends.
 */
function cleanupPolicyState(): void {
  try {
    if (fs.existsSync(POLICY_PATH)) fs.unlinkSync(POLICY_PATH);
  } catch {
    // best-effort cleanup
  }
}

/**
 * Parses a line of OpenClaw CLI output into an AgentEvent.
 * OpenClaw emits JSON-per-line on stdout for structured output.
 * We detect tool calls and results by inspecting the JSON shape,
 * then map them to the existing event types the dashboard expects.
 */
function parseAgentOutput(line: string): AgentEvent | null {
  try {
    const obj = JSON.parse(line);

    // Tool call events
    if (obj.type === "tool_call" || obj.type === "tool_use") {
      const toolName = obj.tool ?? obj.name ?? "";
      if (toolName.includes("search_flights")) {
        return { type: "checking_fares", data: { attempt: obj.call_index ?? 1 } };
      }
      if (toolName.includes("book_flight")) {
        return { type: "booking_triggered", data: { flight: obj.args ?? obj.input ?? {} } };
      }
    }

    // Tool result events
    if (obj.type === "tool_result" || obj.type === "tool_output") {
      const toolName = obj.tool ?? obj.name ?? "";
      if (toolName.includes("search_flights")) {
        const flights = obj.result?.flights ?? obj.output?.flights ?? [];
        if (flights.length > 0) {
          const sorted = [...flights].sort(
            (a: { fare: number }, b: { fare: number }) => a.fare - b.fare
          );
          return { type: "fare_found", data: { flight: sorted[0] } };
        }
        return { type: "no_match", data: { attempt: 1 } };
      }
      if (toolName.includes("book_flight")) {
        const booking = obj.result ?? obj.output ?? {};
        if (booking.status === "CONFIRMED") {
          return { type: "booked", data: { booking } };
        }
      }
    }

    // Agent text message
    if (obj.type === "message" || obj.type === "text" || obj.type === "assistant") {
      const text = obj.content ?? obj.text ?? obj.message ?? "";
      if (text) {
        return { type: "agent_message" as const, data: { text } };
      }
    }

    return null;
  } catch {
    // Non-JSON line — could be an agent text response without JSON wrapper
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("[") && !trimmed.startsWith("{")) {
      return { type: "agent_message" as const, data: { text: trimmed } };
    }
    return null;
  }
}

/**
 * Starts an OpenClaw agent session with the cloak402 skill.
 *
 * 1. Writes the trip policy to shared state
 * 2. Spawns the openclaw CLI
 * 3. Captures stdout (agent output) and stderr (privacy events from tool scripts)
 * 4. Translates everything into AgentEvent callbacks
 * 5. Cleans up state on completion
 */
export async function startOpenClawAgent(
  policy: TripPolicy,
  userMessage: string,
  onEvent: (event: AgentEvent) => void
): Promise<void> {
  // Step 1: Write policy to shared state
  writePolicyState(policy);

  // Step 2: Fire agent_start
  onEvent({ type: "agent_start", data: { policy } });

  // Step 3: Spawn OpenClaw CLI
  // --local: run the embedded agent (uses model provider keys from env)
  // --agent main: use the main agent (cloak402 skill is auto-loaded via workspace)
  // --timeout 300: allow 5 minutes for blockchain transactions (default 600s for
  //   overall agent, but tool exec can timeout earlier without this)
  const proc = spawn(
    "openclaw",
    [
      "agent",
      "--local",
      "--agent", "main",
      "--timeout", "300",
      "--message", userMessage,
    ],
    {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  // Step 4: Parse stdout for agent responses and tool events
  let stdoutBuffer = "";
  proc.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = parseAgentOutput(line);
      if (event) onEvent(event);
    }
  });

  // Step 5: Parse stderr for privacy events from tool scripts
  let stderrBuffer = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.channel === "privacy" && obj.event) {
          onEvent({ type: "privacy_event", data: obj.event });
        }
      } catch {
        // Non-JSON stderr (OpenClaw diagnostics, etc.), skip
      }
    }
  });

  // Step 6: Wait for completion
  return new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => {
      // Flush remaining buffers
      if (stdoutBuffer.trim()) {
        const event = parseAgentOutput(stdoutBuffer);
        if (event) onEvent(event);
      }

      cleanupPolicyState();
      onEvent({ type: "agent_done", data: { spent: 0 } });

      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`OpenClaw agent exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      cleanupPolicyState();
      onEvent({ type: "agent_done", data: { spent: 0 } });
      reject(err);
    });
  });
}
