/**
 * Save tweet sentiment analysis results.
 *
 * Usage: echo '{"signals":[...]}' | node cli/save-tweet-signals.js [--run-id N]
 * Input: JSON from stdin with signals array.
 */

import { sql } from "./db.js";

const args = process.argv.slice(2);
const runId = args.includes("--run-id")
  ? Number(args[args.indexOf("--run-id") + 1])
  : null;

let input = "";
for await (const chunk of process.stdin) input += chunk;

try {
  const { signals } = JSON.parse(input);

  if (!signals || !Array.isArray(signals) || signals.length === 0) {
    console.error("Error: expected { signals: [...] } with at least one entry");
    process.exit(1);
  }

  let saved = 0;
  let errors = 0;

  for (const sig of signals) {
    try {
      await sql`
        INSERT INTO tweet_signals (
          tweet_id, sentiment_score, setup_type, confidence,
          symbols_mentioned, reasoning, model_used,
          input_tokens, output_tokens, estimated_cost_usd, analyzed_at
        ) VALUES (
          ${sig.tweet_id},
          ${sig.sentiment_score},
          ${sig.setup_type || null},
          ${sig.confidence},
          ${sig.symbols_mentioned || []},
          ${sig.reasoning || ""},
          'claude-code-manual',
          0, 0, 0,
          NOW()
        )
        ON CONFLICT (tweet_id) DO NOTHING
      `;
      saved++;
    } catch (err) {
      console.error(`  Failed tweet_id=${sig.tweet_id}: ${err.message}`);
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
  console.error("Error saving signals:", err.message);
  process.exit(1);
}
