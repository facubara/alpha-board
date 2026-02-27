/**
 * Fetch unanalyzed tweets for sentiment analysis.
 *
 * Usage: node cli/fetch-tweets.js [--limit N] [--after-id N]
 * Output: JSON to stdout with tweets array and total_pending count.
 */

import { sql } from "./db.js";

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || 15;
const afterId = args.includes("--after-id")
  ? Number(args[args.indexOf("--after-id") + 1])
  : null;

try {
  const countRows = await sql`
    SELECT COUNT(*) AS cnt
    FROM tweets t
    LEFT JOIN tweet_signals s ON s.tweet_id = t.id
    WHERE s.id IS NULL
  `;
  const totalPending = Number(countRows[0].cnt);

  let rows;
  if (afterId) {
    rows = await sql`
      SELECT
        t.id,
        t.text,
        ta.handle AS author_handle,
        ta.category AS author_category,
        t.metrics,
        t.created_at
      FROM tweets t
      JOIN twitter_accounts ta ON ta.id = t.twitter_account_id
      LEFT JOIN tweet_signals s ON s.tweet_id = t.id
      WHERE s.id IS NULL AND t.id > ${afterId}
      ORDER BY t.id ASC
      LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT
        t.id,
        t.text,
        ta.handle AS author_handle,
        ta.category AS author_category,
        t.metrics,
        t.created_at
      FROM tweets t
      JOIN twitter_accounts ta ON ta.id = t.twitter_account_id
      LEFT JOIN tweet_signals s ON s.tweet_id = t.id
      WHERE s.id IS NULL
      ORDER BY t.id ASC
      LIMIT ${limit}
    `;
  }

  const tweets = rows.map((r) => ({
    id: Number(r.id),
    text: r.text,
    authorHandle: r.author_handle,
    authorCategory: r.author_category,
    metrics: r.metrics || {},
    createdAt: r.created_at,
  }));

  console.log(JSON.stringify({ tweets, total_pending: totalPending }, null, 2));
} catch (err) {
  console.error("Error fetching tweets:", err.message);
  process.exit(1);
}
