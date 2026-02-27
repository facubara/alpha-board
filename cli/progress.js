/**
 * Manage processing_runs progress tracking.
 *
 * Usage:
 *   node cli/progress.js start <task_type> <total>   → creates a run, prints run_id
 *   node cli/progress.js update <run_id> <processed>  → updates processed count
 *   node cli/progress.js pause <run_id>               → pauses a run
 *   node cli/progress.js complete <run_id>            → marks run as completed
 *   node cli/progress.js fail <run_id> <error_msg>    → marks run as failed
 *   node cli/progress.js status                       → shows active runs
 */

import { sql } from "./db.js";

const [command, ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case "start": {
      const [taskType, total] = rest;
      if (!taskType) {
        console.error("Usage: progress.js start <task_type> <total>");
        process.exit(1);
      }
      const rows = await sql`
        INSERT INTO processing_runs (task_type, total_items, status)
        VALUES (${taskType}, ${Number(total) || 0}, 'running')
        RETURNING id
      `;
      console.log(JSON.stringify({ run_id: Number(rows[0].id), task_type: taskType }));
      break;
    }

    case "update": {
      const [runId, processed] = rest;
      await sql`
        UPDATE processing_runs
        SET processed_items = ${Number(processed)}
        WHERE id = ${Number(runId)}
      `;
      console.log(JSON.stringify({ run_id: Number(runId), processed_items: Number(processed) }));
      break;
    }

    case "pause": {
      const [runId] = rest;
      await sql`
        UPDATE processing_runs
        SET status = 'paused', paused_at = NOW()
        WHERE id = ${Number(runId)}
      `;
      console.log(JSON.stringify({ run_id: Number(runId), status: "paused" }));
      break;
    }

    case "complete": {
      const [runId] = rest;
      await sql`
        UPDATE processing_runs
        SET status = 'completed', completed_at = NOW()
        WHERE id = ${Number(runId)}
      `;
      console.log(JSON.stringify({ run_id: Number(runId), status: "completed" }));
      break;
    }

    case "fail": {
      const [runId, ...errorParts] = rest;
      const errorMsg = errorParts.join(" ");
      await sql`
        UPDATE processing_runs
        SET status = 'failed', last_error = ${errorMsg}, completed_at = NOW()
        WHERE id = ${Number(runId)}
      `;
      console.log(JSON.stringify({ run_id: Number(runId), status: "failed" }));
      break;
    }

    case "status": {
      const rows = await sql`
        SELECT id, task_type, status, total_items, processed_items, error_count, started_at
        FROM processing_runs
        WHERE status IN ('running', 'paused')
        ORDER BY started_at DESC
      `;
      console.log(JSON.stringify(rows, null, 2));
      break;
    }

    default:
      console.error("Commands: start, update, pause, complete, fail, status");
      process.exit(1);
  }
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
