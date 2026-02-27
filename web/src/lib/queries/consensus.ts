/**
 * Consensus Queries
 *
 * Fetches agent position consensus from the worker API.
 */

import { workerGet } from "@/lib/worker-client";
import type { ConsensusData } from "@/lib/types";

/**
 * Fetch position consensus across all active agents.
 */
export async function getConsensusData(): Promise<ConsensusData> {
  return workerGet<ConsensusData>("/consensus");
}
