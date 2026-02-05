import { getAllTimeframeRankings } from "@/lib/queries/rankings";
import { RankingsTable } from "@/components/rankings";

/**
 * Rankings Page (Server Component)
 *
 * Fetches all 6 timeframes in parallel on the server.
 * Client-side timeframe switching is instant (no network request).
 */
export default async function RankingsPage() {
  const rankings = await getAllTimeframeRankings();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Rankings</h1>
        <p className="mt-1 text-sm text-secondary">
          Real-time crypto market rankings based on technical indicators
        </p>
      </div>

      {/* Rankings table */}
      <RankingsTable data={rankings} />
    </div>
  );
}
