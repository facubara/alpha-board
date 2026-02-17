"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { ConsensusData, ConsensusItem } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

interface ConsensusBannerProps {
  initialData: ConsensusData;
}

interface SSEMessage {
  type: string;
  technical: ConsensusItem[];
  tweet: ConsensusItem[];
  mixed: ConsensusItem[];
}

function ConsensusRow({
  label,
  items,
}: {
  label: string;
  items: ConsensusItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] w-[72px]">
        {label}
      </span>
      <div className="overflow-hidden flex-1">
        <div className="marquee-container flex hover:[animation-play-state:paused]">
          <div className="marquee-content flex gap-3 pr-3">
            {items.map((item) => (
              <ConsensusItemPill key={item.symbol} item={item} />
            ))}
          </div>
          <div className="marquee-content flex gap-3 pr-3" aria-hidden>
            {items.map((item) => (
              <ConsensusItemPill
                key={`dup-${item.symbol}`}
                item={item}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConsensusItemPill({ item }: { item: ConsensusItem }) {
  const isStrong = item.consensusPct > 70;
  const isLong = item.direction === "long";

  const colorClass = isLong
    ? isStrong
      ? "text-[var(--bullish-strong)]"
      : "text-[var(--bullish-muted)]"
    : isStrong
      ? "text-[var(--bearish-strong)]"
      : "text-[var(--bearish-muted)]";

  return (
    <Link
      href={`/symbols/${item.symbol}`}
      className={`shrink-0 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-mono transition-colors-fast hover:bg-[var(--bg-elevated)] ${colorClass}`}
    >
      <span className="font-medium text-[var(--text-primary)]">
        {item.symbol.replace("USDT", "")}
      </span>
      <span className="uppercase text-[10px] font-semibold">
        {item.direction === "long" ? "L" : "S"}
      </span>
      <span>{item.consensusPct}%</span>
    </Link>
  );
}

export function ConsensusBanner({ initialData }: ConsensusBannerProps) {
  const [data, setData] = useState<ConsensusData>(initialData);

  const onMessage = useCallback((msg: SSEMessage) => {
    if (msg.type === "consensus_update") {
      setData({
        technical: msg.technical,
        tweet: msg.tweet,
        mixed: msg.mixed,
      });
    }
  }, []);

  useSSE<SSEMessage>({
    url: `${WORKER_URL}/sse/consensus`,
    enabled: !!WORKER_URL,
    onMessage,
  });

  const hasAnyData =
    data.technical.length > 0 ||
    data.tweet.length > 0 ||
    data.mixed.length > 0;

  if (!hasAnyData) return null;

  return (
    <div className="border-b border-[var(--border-default)] bg-[var(--bg-base)] py-1.5 px-4 sm:px-8">
      <div className="mx-auto max-w-[1200px] flex flex-col gap-0.5">
        <ConsensusRow label="Technical" items={data.technical} />
        <ConsensusRow label="Tweet" items={data.tweet} />
        <ConsensusRow label="Mixed" items={data.mixed} />
      </div>
    </div>
  );
}
