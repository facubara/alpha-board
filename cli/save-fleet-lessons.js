/**
 * Save fleet lessons from post-mortem analysis.
 *
 * Usage: echo '{"agent_id":1,"lessons":[...]}' | node cli/save-fleet-lessons.js [--run-id N]
 * Input: JSON from stdin with agent_id and lessons array.
 */

import { sql } from "./db.js";

const args = process.argv.slice(2);
const runId = args.includes("--run-id")
  ? Number(args[args.indexOf("--run-id") + 1])
  : null;

let input = "";
for await (const chunk of process.stdin) input += chunk;

try {
  const data = JSON.parse(input);

  if (!data.agent_id || !data.lessons || !Array.isArray(data.lessons)) {
    console.error("Error: required fields: agent_id, lessons[]");
    process.exit(1);
  }

  // Get the agent's archetype
  const agentRows = await sql`
    SELECT strategy_archetype FROM agents WHERE id = ${data.agent_id}
  `;
  if (agentRows.length === 0) {
    console.error(`Error: agent ${data.agent_id} not found`);
    process.exit(1);
  }
  const archetype = agentRows[0].strategy_archetype;

  let saved = 0;
  let errors = 0;

  for (const lesson of data.lessons) {
    try {
      await sql`
        INSERT INTO fleet_lessons (agent_id, archetype, category, lesson, context)
        VALUES (
          ${data.agent_id},
          ${archetype},
          ${lesson.category},
          ${lesson.lesson},
          ${JSON.stringify(lesson.context || {})}
        )
      `;
      saved++;
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
      errors++;
    }
  }

  if (runId) {
    await sql`
      UPDATE processing_runs
      SET processed_items = processed_items + 1,
          error_count = error_count + ${errors}
      WHERE id = ${runId}
    `;
  }

  console.log(JSON.stringify({ saved, errors, agent_id: data.agent_id, run_id: runId }));
} catch (err) {
  console.error("Error saving lessons:", err.message);
  process.exit(1);
}
