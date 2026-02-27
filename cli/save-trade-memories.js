/**
 * Save trade memory/lesson results.
 *
 * Usage: echo '{"memories":[...]}' | node cli/save-trade-memories.js [--run-id N]
 * Input: JSON from stdin with memories array.
 */

import { sql } from "./db.js";

const args = process.argv.slice(2);
const runId = args.includes("--run-id")
  ? Number(args[args.indexOf("--run-id") + 1])
  : null;

let input = "";
for await (const chunk of process.stdin) input += chunk;

try {
  const { memories } = JSON.parse(input);

  if (!memories || !Array.isArray(memories) || memories.length === 0) {
    console.error("Error: expected { memories: [...] } with at least one entry");
    process.exit(1);
  }

  let saved = 0;
  let errors = 0;

  for (const mem of memories) {
    try {
      await sql`
        INSERT INTO agent_memory (agent_id, trade_id, lesson, tags)
        VALUES (${mem.agent_id}, ${mem.trade_id}, ${mem.lesson}, ${JSON.stringify(mem.tags || [])})
      `;
      saved++;
    } catch (err) {
      console.error(`  Failed trade_id=${mem.trade_id}: ${err.message}`);
      errors++;
    }
  }

  if (runId) {
    await sql`
      UPDATE processing_runs
      SET processed_items = processed_items + ${saved},
          error_count = error_count + ${errors}
      WHERE id = ${runId}
    `;
  }

  console.log(JSON.stringify({ saved, errors, run_id: runId }));
} catch (err) {
  console.error("Error saving memories:", err.message);
  process.exit(1);
}
