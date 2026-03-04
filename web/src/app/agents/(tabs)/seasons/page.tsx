import { SeasonsOverview } from "@/components/seasons";
import { getAllSeasons } from "@/lib/queries/seasons";

export const revalidate = 30;

export default async function SeasonsPage() {
  const seasons = await getAllSeasons().catch(() => undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-xl text-text-primary uppercase tracking-widest border-b border-void-border pb-2 mb-1">&gt;_ SEASONS <span className="inline-block leading-none align-middle animate-pulse text-terminal-amber">█</span></h1>
        <p className="font-mono text-xs text-text-secondary uppercase">Per-timeframe season tracking with automatic transitions</p>
      </div>

      <SeasonsOverview seasons={seasons} />
    </div>
  );
}
