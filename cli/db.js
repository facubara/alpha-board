/**
 * Shared DB connection for CLI scripts.
 * Uses the same Neon serverless driver as the web app.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}

export const sql = neon(process.env.DATABASE_URL);
