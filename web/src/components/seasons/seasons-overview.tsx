"use client";

import { useState } from "react";
import type { Timeframe, TimeframeSeason } from "@/lib/types";
import { TimeframeSeasonCard } from "./timeframe-season-card";
import { SeasonHistoryPanel } from "./season-history-panel";

interface Props {
  seasons?: TimeframeSeason[];
}

export function SeasonsOverview({ seasons }: Props) {
  const [selectedTf, setSelectedTf] = useState<Timeframe | null>(null);

  if (!seasons || seasons.length === 0) {
    return (
      <div className="rounded-none border border-void-border bg-void-surface p-8 text-center text-sm text-text-tertiary">
        No season data available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Season cards grid */}
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {seasons.map((season) => (
          <TimeframeSeasonCard
            key={season.timeframe}
            season={season}
            isSelected={selectedTf === season.timeframe}
            onClick={() =>
              setSelectedTf((prev) =>
                prev === season.timeframe ? null : season.timeframe
              )
            }
          />
        ))}
      </div>

      {/* History panel */}
      {selectedTf && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            {selectedTf.toUpperCase()} Season History
          </h3>
          <SeasonHistoryPanel timeframe={selectedTf} />
        </div>
      )}
    </div>
  );
}
