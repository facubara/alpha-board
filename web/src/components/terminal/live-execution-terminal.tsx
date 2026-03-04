"use client";

import { useState, useEffect, useRef } from "react";
import { DottedLoader } from "./dotted-loader";

const FIREHOSE_DATA = [
  "[14:02:01] @WhaleAlert: 500 BTC transferred to Binance",
  "[14:02:02] BINANCE:ETH/USDT VOL SPIKE +4.2%",
  "[14:02:04] @CryptoDegen: $WIF is breaking out of the channel",
  "[14:02:05] MACD CROSSOVER DETECTED: SOL/USDT (15m)",
  "[14:02:07] @NewsBot: FED announces emergency rate pause",
  "[14:02:08] BINANCE:PEPE/USDT ORDERBOOK IMBALANCE (BID SIDE)",
  "[14:02:10] @OnChainLarry: Whale accumulated 12K $BTC",
  "[14:02:11] RSI DIVERGENCE: BTC/USDT (4h) — BULLISH",
  "[14:02:13] @MacroTrader: Risk assets bid on rate cut signal",
  "[14:02:14] BINANCE:SOL/USDT FUNDING RATE ELEVATED 0.08%",
];

const AGENTS = ["RB-SWING", "MOMENTUM-ALPHA", "HYBRID-ORACLE", "SENTIMENT-V2"];
const ACTIONS = ["MARKET BUY", "LIMIT BUY", "MARKET SELL"];

type LogEntry = { key: string; node: React.ReactNode };

export function LiveExecutionTerminal() {
  const [leftLogs, setLeftLogs] = useState<string[]>([]);
  const [rightLogs, setRightLogs] = useState<LogEntry[]>([]);
  const scrollRefLeft = useRef<HTMLDivElement>(null);
  const scrollRefRight = useRef<HTMLDivElement>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    if (scrollRefLeft.current)
      scrollRefLeft.current.scrollTop = scrollRefLeft.current.scrollHeight;
    if (scrollRefRight.current)
      scrollRefRight.current.scrollTop = scrollRefRight.current.scrollHeight;
  }, [leftLogs, rightLogs]);

  useEffect(() => {
    const interval = setInterval(() => {
      const step = stepRef.current;

      // Push raw data to left column
      const newData = FIREHOSE_DATA[step % FIREHOSE_DATA.length];
      setLeftLogs((prev) => [...prev.slice(-15), newData]);

      // Every 3rd tick, simulate AI signal
      if (step % 3 === 0) {
        const eventId = 9912 + step;
        const agent = AGENTS[step % AGENTS.length];
        const action = ACTIONS[step % ACTIONS.length];

        setRightLogs((prev) => [
          ...prev.slice(-15),
          {
            key: `ingest-${step}`,
            node: (
              <span className="text-text-secondary">
                {`> INGESTING EVENT: ID_${eventId}...`}
              </span>
            ),
          },
        ]);

        setTimeout(() => {
          setRightLogs((prev) => [
            ...prev,
            {
              key: `llm-${step}`,
              node: (
                <span className="flex items-center gap-2">
                  <span className="text-text-secondary">
                    &gt; LLM INFERENCE:
                  </span>
                  <DottedLoader />
                </span>
              ),
            },
          ]);
        }, 600);

        setTimeout(() => {
          setRightLogs((prev) => [
            ...prev,
            {
              key: `signal-${step}`,
              node: (
                <span className="text-terminal-amber">
                  &gt; SIGNAL FOUND: STRONG MOMENTUM
                </span>
              ),
            },
            {
              key: `deploy-${step}`,
              node: (
                <span className="text-text-primary">
                  {`> DEPLOYING AGENT: ${agent}`}
                </span>
              ),
            },
            {
              key: `exec-${step}`,
              node: (
                <span className="text-data-profit">
                  {`> EXECUTION: [ ${action} SUCCESS ]`}
                </span>
              ),
            },
            {
              key: `sep-${step}`,
              node: (
                <span className="text-void-border">
                  ────────────────────────────────────
                </span>
              ),
            },
          ]);
        }, 1800);
      }

      stepRef.current++;
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full border border-void-border bg-void-surface flex h-72 sm:h-80 font-mono text-xs rounded-none">
      {/* Left Column: Firehose */}
      <div className="w-1/2 border-r border-void-border p-4 overflow-hidden flex flex-col">
        <div className="text-text-tertiary mb-2 uppercase tracking-widest text-[10px] border-b border-void-border pb-2 font-sans">
          Raw Data Stream
        </div>
        <div
          ref={scrollRefLeft}
          className="flex-1 overflow-y-auto no-scrollbar space-y-1 text-text-secondary pr-2"
        >
          {leftLogs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>

      {/* Right Column: AI Engine */}
      <div className="w-1/2 p-4 overflow-hidden flex flex-col">
        <div className="text-text-tertiary mb-2 uppercase tracking-widest text-[10px] border-b border-void-border pb-2 font-sans">
          Agent Logic
        </div>
        <div
          ref={scrollRefRight}
          className="flex-1 overflow-y-auto no-scrollbar space-y-1"
        >
          {rightLogs.map((entry) => (
            <div key={entry.key}>{entry.node}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
