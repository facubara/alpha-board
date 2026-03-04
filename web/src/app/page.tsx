import Link from "next/link";
import {
  DottedAvatar,
  TerminalButton,
  InteractiveGrid,
  LiveExecutionTerminal,
} from "@/components/terminal";

const agents = [
  {
    id: "RB-SWING-4H",
    name: "Rule-Based Swing",
    description: "Pure technicals. No emotion. Trades the 4H trend with mathematical precision.",
    archetype: "Mean Reversion",
    engine: "Rule Engine",
  },
  {
    id: "HYBRID-ORACLE",
    name: "Hybrid Oracle",
    description: "Combines statistical mean-reversion with live news analysis for conviction trades.",
    archetype: "Hybrid",
    engine: "Claude LLM",
  },
  {
    id: "MOMENTUM-ALPHA",
    name: "Momentum Alpha",
    description: "High-frequency breakout hunter. Identifies explosive moves before the crowd.",
    archetype: "Momentum",
    engine: "Rule Engine",
  },
];

const securityChecks = [
  "API keys encrypted at rest via AES-256.",
  "STRICT Read & Trade permissions only. Zero withdrawal access.",
  "Hardware-level IP restriction to our dedicated Fly.io workers.",
  "Open-source agent logic — audit every decision your bot makes.",
];

export default function LandingPage() {
  return (
    <InteractiveGrid>
      {/* HERO SECTION */}
      <section className="py-20 lg:py-28">
        <div className="text-center space-y-6 max-w-4xl mx-auto mb-16">
          <span className="font-mono text-sm text-terminal-amber tracking-wider">
            &gt;_ SYSTEM STATUS: ACCEPTING NEW DEPLOYMENTS
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-sans font-semibold tracking-tight text-text-primary leading-[1.1]">
            Autonomous Quantitative Trading, Powered by LLMs.
          </h1>

          <p className="text-lg text-text-secondary font-sans max-w-2xl mx-auto leading-relaxed">
            Stop trading on emotion. Deploy institutional-grade AI agents that
            analyze Twitter sentiment, track momentum, and execute trades
            directly on your Binance account 24/7.
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/dashboard">
              <TerminalButton variant="primary">Launch Terminal</TerminalButton>
            </Link>
            <Link href="/agents">
              <TerminalButton variant="secondary">View Live Agent PnL</TerminalButton>
            </Link>
          </div>
        </div>

        {/* Live Execution Terminal */}
        <div className="max-w-4xl mx-auto">
          <LiveExecutionTerminal />
        </div>
      </section>

      {/* TRUST / INFRASTRUCTURE STRIP */}
      <section className="border-y border-void-border py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-xs text-text-tertiary tracking-wider">
          <span>
            INTEGRATIONS:{" "}
            <span className="text-text-secondary">BINANCE SPOT/MARGIN</span>
          </span>
          <span className="text-void-border">|</span>
          <span>
            ENGINES:{" "}
            <span className="text-text-secondary">CLAUDE SONNET 4</span>{" "}
            <span className="text-text-secondary">HAIKU 4.5</span>
          </span>
          <span className="text-void-border">|</span>
          <span>
            INFRA:{" "}
            <span className="text-text-secondary">FLY.IO EDGE WORKERS</span>
          </span>
        </div>
      </section>

      {/* FEATURE 1 — THE AI ADVANTAGE */}
      <section className="py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <span className="font-mono text-xs text-terminal-amber uppercase tracking-widest">
              Sentiment Engine
            </span>
            <h2 className="text-3xl font-sans font-semibold tracking-tight text-text-primary">
              The market moves on narrative. Now, so do you.
            </h2>
            <p className="text-text-secondary font-sans leading-relaxed">
              Alpha-Board doesn&apos;t just read charts. Our Sentiment Agents ingest
              raw Twitter firehoses and memecoin social data in real-time. They
              understand context, identify catalysts, and front-run the crowd.
            </p>
          </div>

          {/* Mock UI: Tweet → LLM output */}
          <div className="space-y-3">
            <div className="bg-void-surface border border-void-border rounded-none p-4">
              <span className="text-xs uppercase tracking-widest text-text-tertiary font-sans">
                Raw Signal
              </span>
              <p className="mt-2 text-sm text-text-secondary font-sans">
                &quot;$SOL ecosystem is cooking. TVL up 40% this month, new protocols
                launching daily. The Solana summer never ended.&quot;
              </p>
              <span className="mt-1 block text-xs text-text-tertiary font-mono">
                @defi_degen · 2m ago
              </span>
            </div>
            <div className="flex items-center justify-center text-terminal-amber font-mono text-xs">
              ▼ LLM ANALYSIS ▼
            </div>
            <div className="bg-void-surface border border-terminal-amber rounded-none p-4">
              <pre className="font-mono text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
{`{
  "symbol":     "SOL",
  "sentiment":  0.92,
  "action":     "BUY",
  "confidence": "HIGH",
  "catalyst":   "TVL growth + ecosystem expansion"
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2 — AGENT MARKETPLACE */}
      <section className="py-20">
        <div className="text-center mb-12 space-y-3">
          <span className="font-mono text-xs text-terminal-amber uppercase tracking-widest">
            Agent Fleet
          </span>
          <h2 className="text-3xl font-sans font-semibold tracking-tight text-text-primary">
            A fleet of specialized agents.
          </h2>
          <p className="text-text-secondary font-sans max-w-2xl mx-auto">
            Don&apos;t know how to code a trading bot? You don&apos;t have to. Browse
            backtested strategies, select your risk profile, and deploy an agent
            in three clicks.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-void-surface border border-void-border rounded-none p-6 space-y-4 hover:border-terminal-amber transition-colors"
            >
              <div className="flex items-center gap-4">
                <DottedAvatar agentId={agent.id} gridSize={6} />
                <div>
                  <span className="font-mono text-sm text-text-primary font-medium">
                    {agent.name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-text-tertiary">
                      {agent.archetype}
                    </span>
                    <span className="text-void-border">·</span>
                    <span className="font-mono text-xs text-text-tertiary">
                      {agent.engine}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-text-secondary font-sans">
                {agent.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURE 3 — SECURITY VAULT */}
      <section className="py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <span className="font-mono text-xs text-terminal-amber uppercase tracking-widest">
              Security
            </span>
            <h2 className="text-3xl font-sans font-semibold tracking-tight text-text-primary">
              Non-Custodial. Bank-Grade Encryption.
            </h2>
            <p className="text-text-secondary font-sans leading-relaxed">
              Alpha-Board never touches your funds. We route trade signals
              directly to your exchange via encrypted, IP-restricted API
              connections.
            </p>
          </div>

          <div className="bg-void-surface border border-void-border rounded-none p-6 space-y-3">
            {securityChecks.map((check, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="font-mono text-sm text-terminal-amber shrink-0 mt-0.5">
                  [&nbsp;*&nbsp;]
                </span>
                <span className="font-mono text-sm text-text-primary">
                  {check}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-20 border-t border-void-border">
        <div className="text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-sans font-semibold tracking-tight text-text-primary">
            Stop watching the charts.
          </h2>
          <p className="text-text-secondary font-sans max-w-lg mx-auto">
            Let autonomous agents handle the execution while you focus on
            strategy.
          </p>
          <div className="pt-2">
            <Link href="/settings">
              <TerminalButton variant="primary">Initialize Connection</TerminalButton>
            </Link>
          </div>
          <p className="font-mono text-xs text-text-tertiary pt-4">
            &gt;_ ALPHA-BOARD v3.0 · SEASON 3 ACTIVE · 28 AGENTS DEPLOYED
          </p>
        </div>
      </section>
    </InteractiveGrid>
  );
}
