/**
 * Save agent performance analysis results.
 *
 * Usage: echo '{"agent_id":1,"summary":"...","full_analysis":"...","recommendations":[...],"metrics_snapshot":{}}' | node cli/save-agent-analysis.js [--run-id N]
 * Input: JSON from stdin.
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

  if (!data.agent_id || !data.summary || !data.full_analysis) {
    console.error("Error: required fields: agent_id, summary, full_analysis");
    process.exit(1);
  }

  const rows = await sql`
    INSERT INTO agent_analysis_history (
      agent_id, analysis_type, summary, full_analysis,
      recommendations, metrics_snapshot, processing_run_id
    ) VALUES (
      ${data.agent_id},
      ${data.analysis_type || "performance_review"},
      ${data.summary},
      ${data.full_analysis},
      ${JSON.stringify(data.recommendations || [])},
      ${JSON.stringify(data.metrics_snapshot || {})},
      ${runId}
    )
    RETURNING id
  `;

  if (runId) {
    await sql`
      UPDATE processing_runs
      SET processed_items = processed_items + 1
      WHERE id = ${runId}
    `;
  }

  console.log(JSON.stringify({ id: Number(rows[0].id), agent_id: data.agent_id }));
} catch (err) {
  console.error("Error saving analysis:", err.message);
  process.exit(1);
}
