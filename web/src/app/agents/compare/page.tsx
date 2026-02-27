import { redirect } from "next/navigation";
import { getComparisonData } from "@/lib/queries/agents";
import { ComparisonView } from "@/components/agents/comparison-view";

/**
 * Agent Comparison Page (Server Component)
 *
 * Reads ?ids=1,5,12 from searchParams, validates 2–4 numeric IDs,
 * fetches comparison data in parallel, renders ComparisonView.
 */

export const dynamic = "force-dynamic";

export default async function AgentComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsParam } = await searchParams;

  if (!idsParam) {
    redirect("/agents");
  }

  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length < 2 || ids.length > 4) {
    redirect("/agents");
  }

  const data = await getComparisonData(ids);

  if (!data) {
    redirect("/agents");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Agent Comparison</h1>
        <p className="mt-1 text-sm text-secondary">
          Comparing {data.agents.length} agents side-by-side
        </p>
      </div>

      <ComparisonView data={data} />
    </div>
  );
}
