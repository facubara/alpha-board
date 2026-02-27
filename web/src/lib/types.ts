/**
 * Alpha Board — TypeScript Types
 *
 * Types matching the database schema from worker/src/models/db.py
 */

// =============================================================================
// Timeframe
// =============================================================================

export type Timeframe = "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export const TIMEFRAMES: Timeframe[] = ["15m", "30m", "1h", "4h", "1d", "1w"];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

// =============================================================================
// Highlights (JSONB from snapshots.highlights)
// =============================================================================

export type HighlightSentiment = "bullish" | "bearish" | "neutral";

export interface Highlight {
  text: string;
  sentiment: HighlightSentiment;
  indicator: string;
}

// =============================================================================
// Indicator Signals (JSONB from snapshots.indicator_signals)
// =============================================================================

export interface IndicatorSignal {
  name: string;
  displayName: string;
  signal: number; // -1 to +1
  label: "bullish" | "bearish" | "neutral";
  description: string;
  rawValues: Record<string, number>;
}

// =============================================================================
// Ranking Snapshot (from snapshots table + symbol join)
// =============================================================================

export interface RankingSnapshot {
  id: number;
  symbol: string;
  symbolId: number;
  baseAsset: string;
  quoteAsset: string;
  timeframe: Timeframe;
  bullishScore: number; // 0.000 to 1.000
  confidence: number; // 0 to 100
  rank: number;
  highlights: Highlight[];
  indicatorSignals: IndicatorSignal[];
  priceChangePct: number | null;
  volumeChangePct: number | null;
  priceChangeAbs: number | null;
  volumeChangeAbs: number | null;
  fundingRate: number | null;
  computedAt: string; // ISO timestamp
  runId: string;
}

// =============================================================================
// Rankings Data (all timeframes combined)
// =============================================================================

export interface RankingsData {
  timeframe: Timeframe;
  snapshots: RankingSnapshot[];
  computedAt: string | null;
}

export type AllTimeframeRankings = Record<Timeframe, RankingsData>;

// =============================================================================
// Computation Run
// =============================================================================

export interface ComputationRun {
  id: string;
  timeframe: Timeframe;
  startedAt: string;
  finishedAt: string | null;
  symbolCount: number | null;
  status: "running" | "completed" | "failed";
  errorMessage: string | null;
}

// =============================================================================
// Symbol
// =============================================================================

export interface Symbol {
  id: number;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

// =============================================================================
// Indicator (from indicators table)
// =============================================================================

export interface Indicator {
  id: number;
  name: string;
  displayName: string;
  category: "momentum" | "trend" | "volatility" | "volume";
  weight: number;
  isActive: boolean;
  config: Record<string, unknown>;
}

// =============================================================================
// Agent Types
// =============================================================================

export type StrategyArchetype =
  | "momentum"
  | "mean_reversion"
  | "breakout"
  | "swing"
  | "tweet_momentum"
  | "tweet_contrarian"
  | "tweet_narrative"
  | "tweet_insider"
  | "hybrid_momentum"
  | "hybrid_mean_reversion"
  | "hybrid_breakout"
  | "hybrid_swing";

export const STRATEGY_ARCHETYPES: StrategyArchetype[] = [
  "momentum",
  "mean_reversion",
  "breakout",
  "swing",
  "tweet_momentum",
  "tweet_contrarian",
  "tweet_narrative",
  "tweet_insider",
  "hybrid_momentum",
  "hybrid_mean_reversion",
  "hybrid_breakout",
  "hybrid_swing",
];

export const STRATEGY_ARCHETYPE_LABELS: Record<StrategyArchetype, string> = {
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  swing: "Swing",
  tweet_momentum: "TW Momentum",
  tweet_contrarian: "TW Contrarian",
  tweet_narrative: "TW Narrative",
  tweet_insider: "TW Insider",
  hybrid_momentum: "Hybrid Momentum",
  hybrid_mean_reversion: "Hybrid Mean Rev",
  hybrid_breakout: "Hybrid Breakout",
  hybrid_swing: "Hybrid Swing",
};

export type AgentTimeframe = Timeframe | "cross";

export const AGENT_TIMEFRAMES: AgentTimeframe[] = [
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
  "cross",
];

export const AGENT_TIMEFRAME_LABELS: Record<AgentTimeframe, string> = {
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
  cross: "Cross-TF",
};

export type AgentEngine = "llm" | "rule";

export const AGENT_ENGINES: AgentEngine[] = ["llm", "rule"];

export const AGENT_ENGINE_LABELS: Record<AgentEngine, string> = {
  llm: "LLM",
  rule: "Rule",
};

export type AgentSource = "technical" | "tweet" | "hybrid";

export const AGENT_SOURCES: AgentSource[] = ["technical", "tweet", "hybrid"];

export const AGENT_SOURCE_LABELS: Record<AgentSource, string> = {
  technical: "Technical",
  tweet: "Tweet",
  hybrid: "Hybrid",
};

export type AgentStatus = "active" | "paused" | "discarded";

// =============================================================================
// Agent Detail Types
// =============================================================================

export interface AgentDetail {
  id: number;
  uuid: string | null;
  name: string;
  displayName: string;
  strategyArchetype: StrategyArchetype;
  timeframe: AgentTimeframe;
  engine: AgentEngine;
  source: AgentSource;
  scanModel: string;
  tradeModel: string;
  evolutionModel: string;
  status: AgentStatus;
  initialBalance: number;
  cashBalance: number;
  totalEquity: number;
  totalRealizedPnl: number;
  unrealizedPnl: number;
  totalFeesPaid: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
  totalTokenCost: number;
  openPositions: number;
  lastCycleAt: string | null;
  discardedAt: string | null;
  discardReason: string | null;
  createdAt: string;
}

export interface AgentTrade {
  id: number;
  agentId: number;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  pnl: number;
  fees: number;
  exitReason: "agent_decision" | "stop_loss" | "take_profit";
  openedAt: string;
  closedAt: string;
  durationMinutes: number;
  reasoningSummary: string | null;
}

export interface AgentDecision {
  id: number;
  agentId: number;
  action: string;
  symbol: string | null;
  reasoningFull: string;
  reasoningSummary: string;
  actionParams: Record<string, unknown> | null;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  promptVersion: number;
  decidedAt: string;
}

export interface AgentPromptVersion {
  id: number;
  agentId: number;
  version: number;
  systemPrompt: string;
  source: "initial" | "auto" | "human";
  diffFromPrevious: string | null;
  performanceAtChange: {
    pnl?: number;
    win_rate?: number;
    trades?: number;
    drawdown?: number;
  } | null;
  createdAt: string;
  isActive: boolean;
}

export interface AgentPosition {
  id: number;
  agentId: number;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  positionSize: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: string;
  unrealizedPnl: number;
}

export interface AgentTokenUsageSummary {
  model: string;
  taskType: "scan" | "trade" | "evolution";
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

// =============================================================================
// Agent Leaderboard
// =============================================================================

// =============================================================================
// Backtest Types
// =============================================================================

export interface BacktestRun {
  id: number;
  agentName: string;
  strategyArchetype: string;
  timeframe: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalEquity: number | null;
  totalPnl: number | null;
  totalTrades: number;
  winningTrades: number;
  maxDrawdownPct: number | null;
  sharpeRatio: number | null;
  equityCurve: { timestamp: string; equity: number }[] | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface BacktestTrade {
  id: number;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  pnl: number;
  fees: number;
  exitReason: string;
  entryAt: string;
  exitAt: string;
  durationMinutes: number;
}

// =============================================================================
// Agent Leaderboard
// =============================================================================

export interface AgentLeaderboardRow {
  id: number;
  uuid: string | null;
  name: string;
  displayName: string;
  strategyArchetype: StrategyArchetype;
  timeframe: AgentTimeframe;
  engine: AgentEngine;
  source: AgentSource;
  scanModel: string;
  tradeModel: string;
  evolutionModel: string;
  status: AgentStatus;
  initialBalance: number;
  cashBalance: number;
  totalEquity: number;
  totalRealizedPnl: number;
  unrealizedPnl: number;
  totalFeesPaid: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
  totalTokenCost: number;
  openPositions: number;
  lastCycleAt: string | null;
  discardedAt: string | null;
  discardReason: string | null;
}

// =============================================================================
// Analytics Types
// =============================================================================

export interface AnalyticsSummary {
  totalPnl: number;
  totalTrades: number;
  totalWins: number;
  totalFees: number;
  totalTokenCost: number;
  totalInitialBalance: number;
  maxDrawdownPct: number;
  grossWins: number;
  grossLosses: number;
  activeAgents: number;
}

export interface ArchetypeStats {
  archetype: StrategyArchetype;
  agentCount: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
  grossWins: number;
  grossLosses: number;
  avgDurationMinutes: number;
}

export interface SourceStats {
  source: AgentSource;
  agentCount: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
  grossWins: number;
  grossLosses: number;
  avgDurationMinutes: number;
}

export interface TimeframeStats {
  timeframe: AgentTimeframe;
  agentCount: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
  grossWins: number;
  grossLosses: number;
  avgDurationMinutes: number;
}

export interface DailyPnl {
  day: string;
  dailyPnl: number;
  cumulativePnl: number;
  tradeCount: number;
  wins: number;
}

export interface DailyArchetypePnl {
  day: string;
  archetype: StrategyArchetype;
  dailyPnl: number;
}

export interface SymbolStats {
  symbol: string;
  tradeCount: number;
  wins: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  totalFees: number;
  grossWins: number;
  grossLosses: number;
  avgDurationMinutes: number;
  longCount: number;
  shortCount: number;
}

export interface DailyTokenCost {
  day: string;
  dailyCost: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelCostBreakdown {
  model: string;
  taskType: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export interface ArchetypeCost {
  archetype: StrategyArchetype;
  totalCost: number;
  totalTokens: number;
  tradeCount: number;
  totalPnl: number;
}

export interface AgentDrawdown {
  id: number;
  displayName: string;
  archetype: StrategyArchetype;
  timeframe: AgentTimeframe;
  peakEquity: number;
  totalEquity: number;
  drawdownPct: number;
}

export interface DirectionStats {
  direction: "long" | "short";
  tradeCount: number;
  wins: number;
  winRate: number;
  totalPnl: number;
  grossWins: number;
  grossLosses: number;
  avgDurationMinutes: number;
}

// =============================================================================
// Twitter Types
// =============================================================================

export type TwitterAccountCategory =
  | "analyst"
  | "founder"
  | "news"
  | "degen"
  | "insider"
  | "protocol";

export const TWITTER_CATEGORIES: TwitterAccountCategory[] = [
  "analyst",
  "founder",
  "news",
  "degen",
  "insider",
  "protocol",
];

export const TWITTER_CATEGORY_LABELS: Record<TwitterAccountCategory, string> = {
  analyst: "Analyst",
  founder: "Founder",
  news: "News",
  degen: "Degen",
  insider: "Insider",
  protocol: "Protocol",
};

export interface TwitterAccount {
  id: number;
  handle: string;
  displayName: string;
  category: TwitterAccountCategory;
  followersCount: number | null;
  bio: string | null;
  isActive: boolean;
  addedAt: string;
  tweetCount?: number;
}

export type TweetSetupType =
  | "long_entry"
  | "short_entry"
  | "take_profit"
  | "warning"
  | "neutral"
  | "informational";

export interface TweetSignal {
  sentimentScore: number;
  setupType: TweetSetupType | null;
  confidence: number;
  symbolsMentioned: string[];
  reasoning: string;
}

export interface TweetData {
  id: number;
  tweetId: string;
  accountHandle: string;
  accountDisplayName: string;
  accountCategory: TwitterAccountCategory;
  text: string;
  createdAt: string;
  metrics: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
    media_urls?: string[];
  };
  ingestedAt: string;
  signal?: TweetSignal;
}

// =============================================================================
// Consensus Types
// =============================================================================

export interface ConsensusItem {
  symbol: string;
  direction: "long" | "short";
  consensusPct: number; // 50-100
  longCount: number;
  shortCount: number;
  totalAgents: number;
}

export interface ConsensusData {
  technical: ConsensusItem[];
  tweet: ConsensusItem[];
  mixed: ConsensusItem[];
}

// =============================================================================
// Trade Notification (live sidebar)
// =============================================================================

export interface TradeNotification {
  id: string;
  type: "trade_opened" | "trade_closed";
  agentName: string;
  agentId: number;
  agentUuid: string;
  engine: AgentEngine;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number | null;
  positionSize: number;
  pnl: number | null;
  pnlPct: number | null;
  exitReason: string | null;
  durationMinutes: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  confidence: number | null;
  reasoningSummary: string | null;
  leaderboardRank: number | null;
  timestamp: string;
  isRead: boolean;
}

// =============================================================================
// Chart Types
// =============================================================================

export interface CandleData {
  openTime: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorValues {
  rsi: (number | null)[];
  macd: (number | null)[];
  macdSignal: (number | null)[];
  macdHistogram: (number | null)[];
  ema20: (number | null)[];
  ema50: (number | null)[];
  ema200: (number | null)[];
  bbUpper: (number | null)[];
  bbMiddle: (number | null)[];
  bbLower: (number | null)[];
}

export interface ChartDataResponse {
  symbol: string;
  timeframe: Timeframe;
  candles: CandleData[];
  indicators: IndicatorValues;
}

export interface TradeMarker {
  time: number; // Unix seconds
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown";
  text: string;
}

// =============================================================================
// Agent Comparison
// =============================================================================

export interface ComparisonData {
  agents: AgentDetail[];
  trades: Record<number, AgentTrade[]>;
}

// =============================================================================
// Symbol-Agent Cross-Referencing
// =============================================================================

export interface SymbolAgentActivity {
  positions: SymbolAgentPosition[];
  trades: SymbolAgentTrade[];
  summary: {
    agentsWithPositions: number;
    agentsThatTraded: number;
    totalTrades: number;
    totalPnl: number;
    winRate: number;
  };
}

export interface SymbolAgentPosition {
  agentId: number;
  agentDisplayName: string;
  archetype: StrategyArchetype;
  timeframe: AgentTimeframe;
  direction: "long" | "short";
  entryPrice: number;
  positionSize: number;
  unrealizedPnl: number;
  openedAt: string;
}

export interface SymbolAgentTrade {
  agentId: number;
  agentDisplayName: string;
  archetype: StrategyArchetype;
  timeframe: AgentTimeframe;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  fees: number;
  closedAt: string;
}

// =============================================================================
// Fleet Lessons
// =============================================================================

// =============================================================================
// Status Types
// =============================================================================

export type ServiceStatus = "operational" | "degraded" | "down";

export interface ServiceCurrent {
  name: string;
  slug: string;
  status: ServiceStatus;
  latency_ms: number | null;
  last_checked: string;
}

export interface ServiceDailyStatus {
  date: string;
  uptime_pct: number;
  incidents: number;
  worst_status: ServiceStatus;
  avg_latency_ms: number | null;
}

export interface ServiceHistory {
  slug: string;
  name: string;
  uptime_30d: number | null;
  uptime_90d: number | null;
  daily: ServiceDailyStatus[];
}

export interface ServiceIncident {
  id: number;
  service: string;
  serviceName: string;
  status: ServiceStatus;
  startedAt: string;
  resolvedAt: string | null;
  durationMinutes: number | null;
  errorSummary: string | null;
}

export interface StatusData {
  overall: ServiceStatus;
  services: ServiceCurrent[];
  activeIncidents: ServiceIncident[];
  history: ServiceHistory[];
  recentIncidents: ServiceIncident[];
}

// =============================================================================
// Fleet Lessons
// =============================================================================

// =============================================================================
// LLM Settings (Cost Control)
// =============================================================================

export interface LlmSection {
  key: string;
  displayName: string;
  description: string;
  enabled: boolean;
  hasApiCost: boolean;
  taskType: string | null;
  updatedAt: string;
}

export interface LlmSectionCost {
  key: string;
  costAlltime: number;
  cost30d: number;
}

// =============================================================================
// Fleet Lessons
// =============================================================================

export type FleetLessonCategory = "strength" | "mistake" | "pattern";

export interface FleetLesson {
  id: number;
  agentId: number;
  agentName: string;
  archetype: string;
  category: FleetLessonCategory;
  lesson: string;
  context: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
}

// =============================================================================
// Exchange / Copy-Trade Types
// =============================================================================

export interface ExchangeSettings {
  configured: boolean;
  enabled?: boolean;
  maskedApiKey?: string;
  tradingMode?: "spot" | "futures" | "both";
  defaultLeverage?: number;
  maxPositionUsd?: number;
  updatedAt?: string;
}

export interface TradeExecuteResult {
  status: "filled" | "error";
  orderId?: string;
  symbol?: string;
  direction?: string;
  market?: string;
  size?: number;
  slOrderId?: string | null;
  tpOrderId?: string | null;
  error?: string;
}

// =============================================================================
// Memecoin Types
// =============================================================================

export type MemecoinCategory = "caller" | "influencer" | "degen" | "news";

export const MEMECOIN_CATEGORIES: MemecoinCategory[] = [
  "caller",
  "influencer",
  "degen",
  "news",
];

export const MEMECOIN_CATEGORY_LABELS: Record<MemecoinCategory, string> = {
  caller: "Caller",
  influencer: "Influencer",
  degen: "Degen",
  news: "News",
};

export interface WatchWallet {
  id: number;
  address: string;
  label: string | null;
  source: string;
  score: number;
  hitCount: number;
  winRate: number | null;
  avgEntryRank: number | null;
  totalTokensTraded: number;
  tokensSummary: {
    symbol: string;
    mint: string;
    entry_rank: number;
    peak_mcap: number | null;
  }[];
  isActive: boolean;
  stats: Record<string, unknown>;
  addedAt: string;
  lastRefreshedAt: string | null;
}

export interface WalletActivity {
  id: number;
  walletId: number;
  walletAddress: string;
  walletLabel: string | null;
  tokenMint: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  direction: "buy" | "sell";
  amountSol: number | null;
  priceUsd: number | null;
  txSignature: string;
  blockTime: string;
  detectedAt: string;
}

export interface MemecoinTwitterAccount {
  id: number;
  handle: string;
  displayName: string;
  category: MemecoinCategory;
  followersCount: number | null;
  bio: string | null;
  isVip: boolean;
  isActive: boolean;
  addedAt: string;
  tweetCount?: number;
}

export interface MemecoinTokenMatch {
  id: number;
  tweetId?: number;
  tokenMint: string | null;
  tokenSymbol: string;
  tokenName: string | null;
  source: "keyword" | "llm";
  dexscreenerUrl: string | null;
  marketCapUsd: number | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  matchedAt: string;
}

export interface MemecoinTweetData {
  id: number;
  tweetId: string;
  accountHandle: string;
  accountDisplayName: string;
  accountCategory: MemecoinCategory;
  isVip: boolean;
  text: string;
  createdAt: string;
  metrics: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    media_urls?: string[];
  };
  ingestedAt: string;
  signal?: TweetSignal;
  tokenMatches?: MemecoinTokenMatch[];
}

export interface MemecoinStats {
  walletsTracked: number;
  avgHitRate: number;
  tweetsToday: number;
  tokenMatchesToday: number;
}

export interface TokenMention {
  tweetId: string;
  tweetText: string;
  createdAt: string;
  accountHandle: string;
  accountDisplayName: string;
  accountCategory: MemecoinCategory;
  isVip: boolean;
  source: "keyword" | "llm";
}

export interface AccountCallHistoryItem {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string | null;
  firstMentionedAt: string;
  mentionCount: number;
  matchTimeMcap: number | null;
  matchTimePrice: number | null;
  athMcap: number | null;
}

// =============================================================================
// Twitter Import Types
// =============================================================================

export interface TwitterImportProgress {
  importId: number;
  status: "pending" | "running" | "completed" | "failed";
  totalAccounts: number;
  processed: number;
  inserted: number;
  skippedExisting: number;
  skippedDiscard: number;
  errors: number;
  currentBatch: number;
  totalBatches: number;
  rateLimitWait: number | null; // seconds remaining, or null
  errorMessage: string | null;
}

export interface TrendingToken {
  rank: number;
  tokenSymbol: string;
  tokenName: string | null;
  tokenMint: string;
  mentionCount: number;
  marketCapUsd: number | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  birdeyeUrl: string;
}

// =============================================================================
// Token Tracker Types
// =============================================================================

export interface TrackedToken {
  id: number;
  mintAddress: string;
  symbol: string | null;
  name: string | null;
  source: "twitter" | "manual";
  refreshIntervalMinutes: number;
  isActive: boolean;
  latestHolders: number | null;
  latestPriceUsd: number | null;
  latestVolume24hUsd: number | null;
  latestMcapUsd: number | null;
  latestLiquidityUsd: number | null;
  lastRefreshedAt: string | null;
  addedAt: string;
}

export interface TokenSnapshot {
  id: number;
  holders: number | null;
  priceUsd: number | null;
  volume24hUsd: number | null;
  mcapUsd: number | null;
  snapshotAt: string;
}

export interface EnrichedToken {
  rank: number;
  tokenSymbol: string;
  tokenName: string | null;
  tokenMint: string;
  mentionCount: number;
  marketCapUsd: number | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  birdeyeUrl: string;
  // Tracker fields
  trackerId: number | null;
  source: "twitter" | "manual" | null;
  refreshIntervalMinutes: number;
  latestHolders: number | null;
  latestVolume24hUsd: number | null;
  lastRefreshedAt: string | null;
  snapshots: TokenSnapshot[];
}

export const TRACKER_REFRESH_INTERVALS = [
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 1440, label: "1d" },
] as const;

// =============================================================================
// Token Analysis
// =============================================================================

export type AnalysisStatus = "pending" | "running" | "paused" | "completed" | "failed";

export interface TokenAnalysis {
  id: number;
  mintAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  marketCapUsd: number | null;
  requestedBuyers: number;
  foundBuyers: number;
  status: AnalysisStatus;
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
  wallets?: AnalyzedWalletResult[];
}

export interface WalletTokenEntry {
  mintAddress: string;
  tokenSymbol: string | null;
  entryRank: number;
  amountSol: number | null;
  tokenPeakMcap: number | null;
}

export interface WalletHolding {
  mint: string;
  symbol: string | null;
  amount: number;
  value_usd: number | null;
}

export interface CrossReferenceResult {
  mintAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  marketCapUsd: number | null;
  buyersScanned: number;
  matches: CrossReferenceMatch[];
}

export interface CrossReferenceMatch {
  address: string;
  entryRank: number | null;
  score: number;
  tags: string[];
  solBalance: number | null;
  totalTxCount: number | null;
  pastTokenCount: number;
  pastTokens: { mintAddress: string; tokenSymbol: string | null; entryRank: number; tokenPeakMcap: number | null; amountSol: number | null }[];
}

export interface AnalyzedWalletResult {
  address: string;
  entryRank: number;
  solBalance: number | null;
  usdcBalance: number | null;
  totalTxCount: number | null;
  tokensTraded: number | null;
  tags: string[];
  amountSol: number | null;
  tokenEntries: WalletTokenEntry[];
  currentHoldings: WalletHolding[];
}

// --- Processing ---

export interface ProcessingRun {
  id: number;
  taskType: string;
  status: "running" | "paused" | "completed" | "failed";
  totalItems: number;
  processedItems: number;
  errorCount: number;
  lastError: string | null;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
}

export interface ProcessingTaskSummary {
  taskType: string;
  pendingCount: number;
  lastRun: ProcessingRun | null;
}

export interface AgentAnalysis {
  id: number;
  agentId: number;
  analysisType: string;
  summary: string;
  fullAnalysis: string;
  recommendations: { action: string; priority: string; details: string }[];
  metricsSnapshot: Record<string, unknown>;
  processingRunId: number | null;
  createdAt: string;
}
