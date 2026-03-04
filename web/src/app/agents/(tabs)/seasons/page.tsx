import { PageHeader } from "@/components/terminal";
import { SeasonsOverview } from "@/components/seasons";
import { getAllSeasons } from "@/lib/queries/seasons";

export const revalidate = 30;

export default async function SeasonsPage() {
  const seasons = await getAllSeasons().catch(() => undefined);

  return (
    <div className="space-y-6">
      <PageHeader title="Seasons" subtitle="Per-timeframe season tracking with automatic transitions" />

      <SeasonsOverview seasons={seasons} />
    </div>
  );
}
