export type WalletStats = {
  address: string;
  proxyWallet: string | null;
  weightedVolume: number;
  profitOnly: number;
  pnl: number;
  lpRewards: number;
  totalPredictions: number;
  accountAgeDays: number;
  consecutiveActiveWeeks: number;
  categoryDiversity: number;
  avgTradeSize: number;
  // Activity metrics
  activeDays: number;             // distinct YYYY-MM-DD that have at least one trade
  daysSinceLastTrade: number;     // 0 = traded today; large = currently idle
  longestIdleStretch: number;     // max gap (in days) between consecutive trade timestamps
};

export type Weights = {
  weightedVolume: number;
  profitOnly: number;
  lpRewards: number;
  perPrediction: number;
  perAccountAgeDay: number;
  perProfileView: number;
  perReferral: number;
  perConsecutiveWeek: number;
  perCategory: number;
  perAvgTradeSizeDollar: number;
  // Activity / retention
  perActiveDay: number;
  xMultiplier: number;
};

export type ScoringInputs = {
  xConnected: boolean;
  profileViews: number;
  referralsInvited: number;
};

export type ScoreRow = {
  key: keyof Weights;
  label: string;
  input: string;
  weight: string;
  points: number;
  isMultiplier?: boolean;
};

export type ScoreResult = {
  totalPoints: number;
  estimatedTokens: number;
  estimatedValueUsd: number;
  poolSharePct: number;
  rows: ScoreRow[];
};

// Polymarket-skewed defaults: tilts toward people who make MANY predictions and
// stay active, rather than whales or lucky PnL. Rationale:
//   - PnL down to ×0.5: profit is partly luck and farmable, so don't over-reward it.
//   - Volume down to ×0.8: still rewards real economic activity, but less than count.
//   - Per-prediction up to ×20: the headline metric for prediction-market loyalty.
//   - Account age ×30, consecutive weeks ×2000: heavy weight on long-term retention.
//   - Avg trade size demoted to ×1: small frequent trades shouldn't be punished.
export const DEFAULT_WEIGHTS: Weights = {
  weightedVolume: 0.8,
  profitOnly: 0.5,
  lpRewards: 3.0,
  perPrediction: 20,
  perAccountAgeDay: 30,
  perProfileView: 10,
  perReferral: 200,
  perConsecutiveWeek: 2000,
  perCategory: 250,
  perAvgTradeSizeDollar: 1,
  // Each distinct day with at least one trade. Loyalty signal that's harder
  // to game than weeks (a single trade per day counts as much as 100).
  perActiveDay: 100,
  xMultiplier: 1.15,
};

export const SLIDER_CONFIG: Record<keyof Weights, { label: string; min: number; max: number; step: number }> = {
  weightedVolume:        { label: "Weighted volume ×",       min: 0, max: 5,    step: 0.1 },
  profitOnly:            { label: "PnL (profit) ×",          min: 0, max: 10,   step: 0.1 },
  lpRewards:             { label: "LP rewards ×",             min: 0, max: 10,   step: 0.1 },
  perPrediction:         { label: "Points per prediction",         min: 0, max: 100,  step: 1   },
  perAccountAgeDay:      { label: "Points per account-age day",    min: 0, max: 200,  step: 1   },
  perProfileView:        { label: "Points per profile view",       min: 0, max: 100,  step: 1   },
  perReferral:           { label: "Points per referral",           min: 0, max: 2000, step: 10  },
  perConsecutiveWeek:    { label: "Points per consecutive week",   min: 0, max: 5000, step: 50  },
  perCategory:           { label: "Points per category",           min: 0, max: 2000, step: 10  },
  perAvgTradeSizeDollar: { label: "Points per $ avg trade size",   min: 0, max: 50,   step: 1   },
  perActiveDay:          { label: "Points per active day",         min: 0, max: 500,  step: 10  },
  xMultiplier:           { label: "X-connected multiplier",        min: 1, max: 2,    step: 0.05 },
};

export type Economics = {
  airdropPct: number;        // 5..35 (percent of 1B total supply allocated to airdrop)
  fdvUsd: number;            // 5e9..100e9
};

export const MAX_TOKENS_PER_WALLET = 100_000;

export const TOTAL_SUPPLY = 1_000_000_000;

export const DEFAULT_ECONOMICS: Economics = {
  airdropPct: 20,
  fdvUsd: 25_000_000_000,
};

export const ECONOMICS_CONFIG = {
  airdropPct: { label: "Airdrop % of supply", min: 5,   max: 35,    step: 0.5,  unit: "%" },
  fdvUsd:     { label: "FDV (fully diluted)", min: 5e9, max: 100e9, step: 1e9,  unit: "$" },
};

// Baseline supply the tier ladder was calibrated against. At airdropPct=20%
// (the default), this yields scale=1 so tier mins read exactly as the
// constants in TIERS.
const BASELINE_AIRDROP_SUPPLY = 200_000_000;

export function airdropSupply(e: Economics): number {
  return Math.round(TOTAL_SUPPLY * (e.airdropPct / 100));
}

export function tokenPriceUsd(e: Economics): number {
  return e.fdvUsd / TOTAL_SUPPLY;
}

export function scaleFactor(e: Economics): number {
  return airdropSupply(e) / BASELINE_AIRDROP_SUPPLY;
}

// Derived from Hyperliquid's HYPE genesis distribution percentiles, scaled to a
// hypothetical $POLY airdrop of 310M tokens to ~100k wallets.
//   Reference HYPE allocation per percentile:
//     min   0.11
//     p10   4.28
//     p25   14.98
//     p50   64.42      (median)
//     p75   379.90
//     p99   58,317.95
//     max   1,975,126.70
// Tier thresholds approximate cohort cutoffs.
export type Tier = {
  rank: string;        // "Top 100", "Top 1k", etc.
  cohortSize: number;  // 100, 1000, 10000, 50000, 100000
  minTokens: number;   // floor token amount to land in this tier
  medianTokens: number; // typical allocation inside the tier
  maxTokens: number;   // ceiling token amount for this tier
};

// Anchored on Hyperliquid HYPE genesis distribution:
//   max 1,975,127 · p99 58,318 · p75 380 · p50 64 · p25 15 · p10 4.3 · min 0.11
// Scaled up ~1.5× for a hypothetical $POLY airdrop of 310M tokens.
// Eligibility model: only the top ~100k wallets receive any $POLY (matches
// Hyperliquid's ~94k eligible cohort). Tiers are percentiles within that pool.
export const ELIGIBLE_WALLET_COUNT = 100_000;

// Percentile-based tier ladder. cohortSize = how many wallets fit in this
// bucket (cumulative from the top). min/median/maxTokens are calibrated
// against real Polymarket volume data (see POINTS_ANCHORS).
export const TIERS: Tier[] = [
  { rank: "Top 0.1%",      cohortSize: 100,     minTokens: 30_000, medianTokens: 60_000, maxTokens: 100_000 },
  { rank: "Top 1%",        cohortSize: 1_000,   minTokens: 10_000, medianTokens: 18_000, maxTokens: 30_000  },
  { rank: "Top 5%",        cohortSize: 5_000,   minTokens: 4_500,  medianTokens: 7_000,  maxTokens: 10_000  },
  { rank: "Top 10%",       cohortSize: 10_000,  minTokens: 1_500,  medianTokens: 2_800,  maxTokens: 4_500   },
  { rank: "Top 20%",       cohortSize: 20_000,  minTokens: 600,    medianTokens: 1_000,  maxTokens: 1_500   },
  { rank: "Top 50%",       cohortSize: 50_000,  minTokens: 65,     medianTokens: 250,    maxTokens: 600     },
  { rank: "Eligible (rest)", cohortSize: 100_000, minTokens: 1,    medianTokens: 25,     maxTokens: 65      },
];

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Linear ramp: idle <=30d => 1.0, idle >=180d => 0.3. Smooth in between.
export function idleDecayFactor(daysIdle: number): number {
  if (daysIdle <= 30) return 1;
  if (daysIdle >= 180) return 0.3;
  return 1 - ((daysIdle - 30) / (180 - 30)) * 0.7;
}

export function score(stats: WalletStats, ui: ScoringInputs, weights: Weights, economics: Economics = DEFAULT_ECONOMICS): ScoreResult {
  const profitOnly = Math.max(0, stats.profitOnly);

  const ptsVolume = stats.weightedVolume * weights.weightedVolume;
  const ptsProfit = profitOnly * weights.profitOnly;
  const ptsLp = stats.lpRewards * weights.lpRewards;
  const ptsPredictions = stats.totalPredictions * weights.perPrediction;
  const ptsAge = stats.accountAgeDays * weights.perAccountAgeDay;
  const ptsViews = ui.profileViews * weights.perProfileView;
  const ptsReferrals = ui.referralsInvited * weights.perReferral;
  const ptsWeeks = stats.consecutiveActiveWeeks * weights.perConsecutiveWeek;
  const ptsCategories = stats.categoryDiversity * weights.perCategory;
  const ptsAvgTrade = stats.avgTradeSize * weights.perAvgTradeSizeDollar;
  const ptsActiveDays = stats.activeDays * weights.perActiveDay;

  const subtotal =
    ptsVolume + ptsProfit + ptsLp + ptsPredictions + ptsAge + ptsViews + ptsReferrals +
    ptsWeeks + ptsCategories + ptsAvgTrade + ptsActiveDays;

  // Idle decay: wallets that haven't traded in a while shouldn't get full
  // credit. Linear ramp from 1.0 (idle <=30d) down to 0.3 (idle >=180d).
  const idleDecay = idleDecayFactor(stats.daysSinceLastTrade);

  const xMult = ui.xConnected ? weights.xMultiplier : 1;
  const totalPoints = Math.round(subtotal * xMult * idleDecay);

  // Token allocation is derived from the user's points falling into a Hyperliquid-style
  // power-law curve. We approximate using a piecewise log-linear interpolation
  // anchored on the tier thresholds.
  const scale = scaleFactor(economics);
  // Hard cap on the per-wallet allocation. Real airdrops almost always have
  // one — Hyperliquid capped individual claims at ~1.97M HYPE. We cap at
  // 100k $POLY by default, which keeps the tier curve from blowing up at the
  // top end and protects the median wallet's slice.
  const cappedTokens = Math.min(MAX_TOKENS_PER_WALLET, tokensFromPoints(totalPoints) * scale);
  const estimatedTokens = Math.round(cappedTokens);
  const poolSharePct = (estimatedTokens / airdropSupply(economics)) * 100;
  const estimatedValueUsd = estimatedTokens * tokenPriceUsd(economics);

  const rows: ScoreRow[] = [
    { key: "weightedVolume",        label: "Weighted volume",        input: fmtUsd(stats.weightedVolume),                 weight: `×${weights.weightedVolume.toFixed(2)}`, points: ptsVolume },
    { key: "profitOnly",            label: "PnL (profit only)",      input: fmtUsd(stats.pnl),                            weight: `×${weights.profitOnly.toFixed(2)}`,     points: ptsProfit },
    { key: "lpRewards",             label: "LP rewards",             input: fmtUsd(stats.lpRewards),                      weight: `×${weights.lpRewards.toFixed(2)}`,      points: ptsLp },
    { key: "perPrediction",         label: "Markets traded",         input: stats.totalPredictions.toLocaleString(),      weight: `×${weights.perPrediction}/market`,      points: ptsPredictions },
    { key: "perAccountAgeDay",      label: "Account age",            input: `${stats.accountAgeDays}d`,                   weight: `×${weights.perAccountAgeDay}/day`,      points: ptsAge },
    { key: "perProfileView",        label: "Profile views",          input: ui.profileViews.toLocaleString(),             weight: `×${weights.perProfileView}/view`,       points: ptsViews },
    { key: "perReferral",           label: "Referrals invited",      input: ui.referralsInvited.toLocaleString(),         weight: `×${weights.perReferral}/ref`,           points: ptsReferrals },
    { key: "perConsecutiveWeek",    label: "Consecutive weeks",      input: stats.consecutiveActiveWeeks.toLocaleString(),weight: `×${weights.perConsecutiveWeek}/wk`,     points: ptsWeeks },
    { key: "perCategory",           label: "Category diversity",     input: stats.categoryDiversity.toLocaleString(),     weight: `×${weights.perCategory}/cat`,           points: ptsCategories },
    { key: "perAvgTradeSizeDollar", label: "Avg trade size",         input: `$${stats.avgTradeSize.toFixed(2)}`,          weight: `×${weights.perAvgTradeSizeDollar}/$`,   points: ptsAvgTrade },
    { key: "perActiveDay",          label: "Active days",            input: `${stats.activeDays.toLocaleString()}${stats.daysSinceLastTrade > 0 ? ` (${stats.daysSinceLastTrade}d idle)` : ""}`, weight: `×${weights.perActiveDay}/day`, points: ptsActiveDays },
    { key: "xMultiplier",           label: "X connected",            input: ui.xConnected ? "Yes" : "No",                 weight: `×${weights.xMultiplier.toFixed(2)}`,    points: ui.xConnected ? Math.round(subtotal * (weights.xMultiplier - 1)) : 0, isMultiplier: true },
  ];
  if (idleDecay < 1) {
    rows.push({ key: "perActiveDay", label: "Idle decay", input: `${stats.daysSinceLastTrade}d idle`, weight: `×${idleDecay.toFixed(2)}`, points: Math.round(subtotal * (idleDecay - 1)), isMultiplier: true });
  }

  return { totalPoints, estimatedTokens, estimatedValueUsd, poolSharePct, rows };
}

// Calibrated against Polymarket's real rank → volume distribution sampled
// 2026-05 from data-api.polymarket.com/v1/leaderboard?orderBy=VOL&timePeriod=ALL.
// Each anchor pairs (points, tokens) such that a volume-only score (where
// points ≈ volume × weights.weightedVolume at the default 0.8 weight) lands a
// wallet in roughly the same tier as its actual Polymarket leaderboard rank.
//
//   Rank     | Vol         | Pts (vol × 0.8) | Tier               | Min tokens
//   ---------+-------------+-----------------+--------------------+-----------
//   #1       | $820M       | 656M            | Top 10             | 500k
//   #10      | $460M       | 368M            | Top 10 floor       | 500k → 1.97M
//   #100     | $127M       | 102M            | Top 100 floor      | 100k
//   #1,000   | $19M        | 15M             | Top 1,000 floor    | 15k
//   #5,000   | $3.5M       | 2.8M            | Top 10k mid        | 5.5k
//   #10,000  | $1.6M       | 1.3M            | Top 10,000 floor   | 1.5k
//   #25,000  | ~$0.8M      | ~640k           | Top 25,000 floor   | 380
//   #50,000  | ~$0.4M      | ~320k           | Top 50,000 floor   | 65
//   #100,000 | ~$0.05M     | ~40k            | All claimers floor | 1
// Calibrated points → tokens curve. Each anchor maps a points score to its
// estimated $POLY allocation, given that the eligible pool is the top 100k
// wallets. The right column equals the corresponding TIERS[].minTokens.
const POINTS_ANCHORS: Array<[number, number]> = [
  [0,             0],
  [40_000,        1],         // 100% (eligible-rest floor)
  [320_000,       65],        // Top 50% floor
  [800_000,       600],       // Top 20% floor
  [1_300_000,     1_500],     // Top 10% floor
  [3_300_000,     4_500],     // Top 5% floor
  [15_000_000,    10_000],    // Top 1% floor
  [102_000_000,   30_000],    // Top 0.1% floor
  [656_000_000,   100_000],   // Cap
];

function tokensFromPoints(points: number): number {
  if (points <= 0) return 0;
  for (let i = 1; i < POINTS_ANCHORS.length; i++) {
    const [p0, t0] = POINTS_ANCHORS[i - 1];
    const [p1, t1] = POINTS_ANCHORS[i];
    if (points <= p1) {
      if (p0 === 0) {
        // linear interp on first segment to avoid log(0)
        const ratio = points / p1;
        return Math.round(t0 + (t1 - t0) * ratio);
      }
      const logP = Math.log(points);
      const logRatio = (logP - Math.log(p0)) / (Math.log(p1) - Math.log(p0));
      const logT = Math.log(t0) + (Math.log(t1) - Math.log(t0)) * logRatio;
      return Math.round(Math.exp(logT));
    }
  }
  return POINTS_ANCHORS[POINTS_ANCHORS.length - 1][1];
}

export function scaleTier(t: Tier, economics: Economics): Tier {
  const s = scaleFactor(economics);
  return {
    ...t,
    minTokens: Math.round(t.minTokens * s),
    medianTokens: Math.round(t.medianTokens * s),
    maxTokens: Math.round(t.maxTokens * s),
  };
}

export function scaledTiers(economics: Economics): Tier[] {
  return TIERS.map((t) => scaleTier(t, economics));
}

export function getTier(estimatedTokens: number, economics: Economics = DEFAULT_ECONOMICS): Tier | null {
  if (estimatedTokens <= 0) return null;
  const scaled = scaledTiers(economics);
  for (const t of scaled) {
    if (estimatedTokens >= t.minTokens) return t;
  }
  return null;
}

export function isEligible(estimatedTokens: number, economics: Economics = DEFAULT_ECONOMICS): boolean {
  return getTier(estimatedTokens, economics) !== null;
}
