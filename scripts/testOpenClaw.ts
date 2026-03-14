#!/usr/bin/env npx tsx
// scripts/testOpenClaw.ts
//
// End-to-end test script for the OpenClaw agent integration.
// Tests: direct CLI tools, OpenClaw agent round-trips, and the chat API.
//
// Usage:
//   npx tsx scripts/testOpenClaw.ts              # run all tests
//   npx tsx scripts/testOpenClaw.ts --tools      # direct tool scripts only
//   npx tsx scripts/testOpenClaw.ts --agent      # OpenClaw agent only
//   npx tsx scripts/testOpenClaw.ts --api        # chat API only

import { execSync, spawn } from "child_process";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const TOOL_DIR = path.join(ROOT, "skills/cloak402/tools");

// ── Helpers ──────────────────────────────────────────────────────────────

function log(label: string, msg: string) {
  console.log(`\n[${"=".repeat(60)}]`);
  console.log(`[TEST] ${label}`);
  console.log(`[${"=".repeat(60)}]`);
  console.log(msg);
}

function pass(name: string) {
  console.log(`  ✅ PASS: ${name}`);
}

function fail(name: string, reason: string) {
  console.log(`  ❌ FAIL: ${name} — ${reason}`);
  failures.push(name);
}

const failures: string[] = [];

function runTool(script: string, args: string): any {
  const cmd = `cd ${ROOT} && npx tsx ${path.join(TOOL_DIR, script)} ${args}`;
  const stdout = execSync(cmd, {
    encoding: "utf-8",
    timeout: 120_000,
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();

  // Parse the last JSON line from stdout (tool scripts emit JSON)
  const lines = stdout.split("\n").filter((l) => l.trim());
  const lastLine = lines[lines.length - 1];
  return JSON.parse(lastLine);
}

function runAgent(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "openclaw",
      ["agent", "--local", "--agent", "main", "--timeout", "300", "--message", message],
      { cwd: ROOT, env: { ...process.env }, stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Agent exited ${code}: ${stderr.slice(0, 500)}`));
      } else {
        resolve(stdout.trim());
      }
    });
    proc.on("error", reject);

    // Safety timeout
    setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Agent timed out after 5 minutes"));
    }, 300_000);
  });
}

// ── Test suites ──────────────────────────────────────────────────────────

async function testTools() {
  log("TOOLS", "Testing direct CLI tool invocations\n");

  // 1. search_flights
  try {
    const result = runTool("search_flights.ts", "--from BOM --to BLR --maxFare 4500");
    if (!result.flights || !Array.isArray(result.flights)) {
      fail("search_flights — response shape", "missing flights array");
    } else if (result.flights.length === 0) {
      fail("search_flights — results", "no flights returned");
    } else {
      const allUnderMax = result.flights.every((f: any) => f.fare <= 4500);
      if (!allUnderMax) fail("search_flights — fare filter", "flights above maxFare returned");
      else pass(`search_flights — found ${result.flights.length} flights`);
    }

    if (result.privacy?.walletUsed) {
      pass(`search_flights — ephemeral wallet: ${result.privacy.walletUsed.slice(0, 10)}...`);
    } else {
      fail("search_flights — privacy", "no walletUsed in response");
    }

    if (result.privacy?.txHash) {
      pass(`search_flights — tx hash: ${result.privacy.txHash.slice(0, 14)}...`);
    } else {
      fail("search_flights — tx hash", "no txHash in response");
    }
  } catch (err: any) {
    fail("search_flights", err.message);
  }

  // 2. book_flight
  try {
    const result = runTool(
      "book_flight.ts",
      '--flightId F003 --passengerName "Test User" --passengerEmail test@example.com'
    );
    if (result.status !== "CONFIRMED") {
      fail("book_flight — status", `expected CONFIRMED, got ${result.status}`);
    } else {
      pass(`book_flight — confirmed: ${result.bookingId}`);
    }

    if (result.privacy?.walletUsed) {
      pass(`book_flight — ephemeral wallet: ${result.privacy.walletUsed.slice(0, 10)}...`);
    } else {
      fail("book_flight — privacy", "no walletUsed in response");
    }
  } catch (err: any) {
    fail("book_flight", err.message);
  }

  // 3. get_trip_policy (may not have a policy file — should still not crash)
  try {
    const result = runTool("get_trip_policy.ts", "");
    if (result.error) {
      pass(`get_trip_policy — no active policy (expected when not in session): ${result.error}`);
    } else if (result.from) {
      pass(`get_trip_policy — loaded policy: ${result.from} → ${result.to}`);
    } else {
      pass("get_trip_policy — returned without error");
    }
  } catch (err: any) {
    fail("get_trip_policy", err.message);
  }
}

async function testAgent() {
  log("AGENT", "Testing OpenClaw agent round-trips\n");

  // 1. Flight search via agent
  try {
    const output = await runAgent("Search for flights from BOM to BLR under 4500 rupees");
    if (!output) {
      fail("agent search", "empty response");
    } else if (output.toLowerCase().includes("flight") || output.toLowerCase().includes("bom") || output.toLowerCase().includes("blr")) {
      pass("agent search — got flight results");
      console.log(`    Response preview: ${output.slice(0, 200)}...`);
    } else {
      fail("agent search", `unexpected response: ${output.slice(0, 200)}`);
    }

    // Check for privacy reporting
    if (output.toLowerCase().includes("wallet") || output.toLowerCase().includes("ephemeral") || output.toLowerCase().includes("privacy")) {
      pass("agent search — reports privacy actions");
    }
  } catch (err: any) {
    fail("agent search", err.message);
  }

  // 2. Booking via agent
  try {
    const output = await runAgent(
      "Book flight F003 for passenger Test User, email test@example.com"
    );
    if (!output) {
      fail("agent booking", "empty response");
    } else if (
      output.toLowerCase().includes("confirm") ||
      output.toLowerCase().includes("book") ||
      output.toLowerCase().includes("ticket")
    ) {
      pass("agent booking — got confirmation");
      console.log(`    Response preview: ${output.slice(0, 200)}...`);
    } else {
      fail("agent booking", `unexpected response: ${output.slice(0, 200)}`);
    }
  } catch (err: any) {
    fail("agent booking", err.message);
  }
}

async function testChatApi() {
  log("CHAT API", "Testing /api/chat endpoint (requires next dev running on :3000)\n");

  try {
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Search for flights from BOM to BLR under 4500",
        policy: { from: "BOM", to: "BLR", maxFare: 4500, autoBook: false },
      }),
    });

    if (!response.ok) {
      fail("chat API", `HTTP ${response.status}`);
      return;
    }

    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      pass("chat API — returns SSE stream");
    } else {
      fail("chat API — content-type", "expected text/event-stream");
    }

    // Read a few events
    const text = await response.text();
    const events = text.split("\n\n").filter((e) => e.startsWith("data:"));
    if (events.length > 0) {
      pass(`chat API — received ${events.length} SSE events`);
    } else {
      fail("chat API — events", "no SSE events received");
    }
  } catch (err: any) {
    if (err.message?.includes("ECONNREFUSED")) {
      console.log("  ⏭️  SKIP: Next.js dev server not running on :3000");
    } else {
      fail("chat API", err.message);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.length === 0;

  console.log("🧪 Cloak402 — OpenClaw Integration Tests\n");

  // Pre-flight checks
  try {
    execSync("which openclaw", { stdio: "pipe" });
    pass("openclaw CLI found");
  } catch {
    fail("pre-flight", "openclaw CLI not found in PATH");
    process.exit(1);
  }

  if (runAll || args.includes("--tools")) {
    await testTools();
  }

  if (runAll || args.includes("--agent")) {
    await testAgent();
  }

  if (runAll || args.includes("--api")) {
    await testChatApi();
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  if (failures.length === 0) {
    console.log("🎉 All tests passed!");
  } else {
    console.log(`💥 ${failures.length} test(s) failed:`);
    failures.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
