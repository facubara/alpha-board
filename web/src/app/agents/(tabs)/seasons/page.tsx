import { Suspense } from "react";
import { SeasonsOverview } from "@/components/seasons";
import { getAllSeasons } from "@/lib/queries/seasons";

export const revalidate = 30;

async function SeasonsContent() {
  const seasons = await getAllSeasons().catch(() => undefined);
  return <SeasonsOverview seasons={seasons} />;
}

function SeasonsContentSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-none border border-void-border bg-void-surface p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 rounded-none bg-void-muted skeleton" />
            <div className="h-4 w-16 rounded-none bg-void-muted skeleton" />
          </div>
          <div className="h-3 w-full rounded-none bg-void-muted skeleton" />
          <div className="flex justify-between">
            <div className="h-3 w-20 rounded-none bg-void-muted skeleton" />
            <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
          </div>
          <div className="h-3 w-3/4 rounded-none bg-void-muted skeleton" />
        </div>
      ))}
    </div>
  );
}

export default function SeasonsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-xl text-text-primary uppercase tracking-widest border-b border-void-border pb-2 mb-1">&gt;_ SEASONS <span className="inline-block leading-none align-middle animate-pulse text-terminal-amber">█</span></h1>
        <p className="font-mono text-xs text-text-secondary uppercase">Per-timeframe season tracking with automatic transitions</p>
      </div>

      <Suspense fallback={<SeasonsContentSkeleton />}>
        <SeasonsContent />
      </Suspense>
    </div>
  );
}
