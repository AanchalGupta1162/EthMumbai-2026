// skills/cloak402/tools/get_trip_policy.ts
//
// CLI tool to read the current trip policy from shared state.
// Invoked by OpenClaw agent: npx tsx skills/cloak402/tools/get_trip_policy.ts
//
// The policy is written by the web dashboard or chat handler into
// .openclaw/state/trip_policy.json before spawning the agent.

import fs from "fs";
import path from "path";

const POLICY_PATH = path.resolve(__dirname, "../../../.openclaw/state/trip_policy.json");

function main() {
  if (!fs.existsSync(POLICY_PATH)) {
    process.stdout.write(
      JSON.stringify({
        error: "No active trip policy found. Ask the user for their trip details: origin, destination, max fare, budget, and passenger info.",
      }) + "\n"
    );
    process.exit(0);
  }

  const raw = fs.readFileSync(POLICY_PATH, "utf-8");
  const policy = JSON.parse(raw);
  process.stdout.write(JSON.stringify(policy) + "\n");
}

main();
