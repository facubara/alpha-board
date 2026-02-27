import {
  getProcessingTaskSummaries,
  getProcessingRunHistory,
} from "@/lib/queries/processing";
import { ProcessingDashboard } from "@/components/processing/processing-dashboard";

/**
 * Processing Page (Server Component)
 *
 * Shows pending counts per task type, run/pause controls, and run history.
 * ISR: revalidates every 30 seconds.
 */

export const revalidate = 30;

export const metadata = {
  title: "Processing | Alpha Board",
};

export default async function ProcessingPage() {
  const [taskSummaries, runHistory] = await Promise.all([
    getProcessingTaskSummaries(),
    getProcessingRunHistory(20),
  ]);

  return (
    <ProcessingDashboard
      taskSummaries={taskSummaries}
      runHistory={runHistory}
    />
  );
}
