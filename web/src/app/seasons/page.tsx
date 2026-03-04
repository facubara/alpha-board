import { SeasonsOverview } from "@/components/seasons";
import { getAllSeasons } from "@/lib/queries/seasons";

export const revalidate = 30;

export default async function SeasonsPage() {
  const seasons = await getAllSeasons().catch(() => undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Seasons
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Per-timeframe season tracking with automatic transitions
        </p>
      </div>

      <SeasonsOverview seasons={seasons} />
    </div>
  );
}
