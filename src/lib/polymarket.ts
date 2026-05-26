import type { WalletStats } from "./scoring";

const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

type LeaderboardEntry = {
  proxyWallet?: string;
  vol?: number;
  pnl?: number;
  userName?: string;
};

type Trade = {
  proxyWallet: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: number;
  conditionId: string;
  eventSlug?: string;
  slug?: string;
};

type Position = {
  proxyWallet: string;
  conditionId: string;
  currentValue: number;
  cashPnl: number;
  realizedPnl: number;
  slug?: string;
  eventSlug?: string;
  title?: string;
};

type ActivityItem = {
  type: "TRADE" | "SPLIT" | "MERGE" | "REDEEM" | "REWARD" | "CONVERSION";
  timestamp: number;
  usdcSize?: number;
  conditionId: string;
  slug?: string;
};

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Polymarket ${res.status} on ${url}`);
  return (await res.json()) as T;
}

const PAGE_SIZE = 500;
const MAX_OFFSET = 3000; // Polymarket caps offset; stay safely under

async function fetchAllTrades(user: string): Promise<Trade[]> {
  const out: Trade[] = [];
  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE_SIZE) {
    const page = await getJson<Trade[]>(
      `${DATA_API}/trades?user=${user}&limit=${PAGE_SIZE}&offset=${offset}&takerOnly=false`
    );
    if (!page || page.length === 0) break;
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

async function fetchAllActivity(user: string): Promise<ActivityItem[]> {
  const out: ActivityItem[] = [];
  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE_SIZE) {
    const page = await getJson<ActivityItem[]>(
      `${DATA_API}/activity?user=${user}&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!page || page.length === 0) break;
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

function uniqueWeeks(timestampsSec: number[]): number {
  const weeks = new Set<string>();
  for (const t of timestampsSec) {
    const d = new Date(t * 1000);
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.floor((d.getTime() - jan1.getTime()) / (7 * 24 * 60 * 60 * 1000));
    weeks.add(`${d.getUTCFullYear()}-${week}`);
  }
  return weeks.size;
}

function longestConsecutiveWeeks(timestampsSec: number[]): number {
  if (timestampsSec.length === 0) return 0;
  const weekKeys = new Set<number>();
  for (const t of timestampsSec) {
    const weekStart = Math.floor(t / (7 * 24 * 60 * 60));
    weekKeys.add(weekStart);
  }
  const sorted = [...weekKeys].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

function inferCategory(slugOrSlug?: string, eventSlug?: string): string {
  const haystack = `${slugOrSlug ?? ""} ${eventSlug ?? ""}`.toLowerCase();
  const buckets: Record<string, string[]> = {
    crypto: ["bitcoin", "btc", "ethereum", "eth", "solana", "sol", "crypto", "token", "coin"],
    politics: ["election", "trump", "biden", "harris", "president", "senate", "congress", "vote", "politic"],
    sports: ["nfl", "nba", "mlb", "soccer", "fifa", "premier", "uefa", "champion", "super-bowl", "ufc", "boxing", "tennis", "f1", "formula"],
    geopolitics: ["russia", "ukraine", "israel", "gaza", "china", "war", "ceasefire", "iran"],
    economy: ["fed", "rate", "inflation", "gdp", "recession", "jobs", "cpi"],
    tech: ["openai", "ai", "tesla", "musk", "apple", "google", "meta", "x-corp"],
    entertainment: ["oscar", "grammy", "movie", "billion", "netflix", "album"],
    weather: ["hurricane", "storm", "temperature"],
  };
  for (const [name, keys] of Object.entries(buckets)) {
    if (keys.some((k) => haystack.includes(k))) return name;
  }
  return "other";
}

export async function fetchWalletStats(address: string): Promise<WalletStats> {
  const addr = address.toLowerCase().trim();

  const [leaderboardRaw, trades, activity, oldestTrade, oldestActivity, profile, tradedCount] =
    await Promise.all([
      getJson<LeaderboardEntry[]>(`${DATA_API}/v1/leaderboard?user=${addr}&timePeriod=ALL`).catch(() => null),
      fetchAllTrades(addr),
      fetchAllActivity(addr),
      // ASC-sorted single record fallback for age when /public-profile fails.
      getJson<Trade[]>(`${DATA_API}/trades?user=${addr}&limit=1&offset=0&takerOnly=false&sortDirection=ASC`).catch(() => null),
      getJson<ActivityItem[]>(`${DATA_API}/activity?user=${addr}&limit=1&offset=0&sortDirection=ASC`).catch(() => null),
      // Authoritative profile from Gamma — gives the real account creation time.
      getJson<{ createdAt?: string }>(`${GAMMA_API}/public-profile?address=${addr}`).catch(() => null),
      // Authoritative count of distinct markets traded — the headline number on polymarket.com profiles.
      getJson<{ traded?: number }>(`${DATA_API}/traded?user=${addr}`).catch(() => null),
    ]);

  const leaderboard: LeaderboardEntry[] = leaderboardRaw ?? [];
  const lb = leaderboard[0];
  const proxyWallet = lb?.proxyWallet ?? trades[0]?.proxyWallet ?? null;

  // Volume from trades is sum(size * price). Leaderboard `vol` is authoritative when available.
  const tradeVolume = trades.reduce((acc, t) => acc + t.size * t.price, 0);
  const weightedVolume = lb?.vol ?? tradeVolume;
  const pnl = lb?.pnl ?? 0;

  // Prefer Polymarket's authoritative count of distinct markets traded (the
  // "predictions" number on the profile page). Falls back to our paged trade
  // count if /traded fails. trades.length is also used for avg trade size,
  // categories and weeks since those need per-trade data.
  const tradeCount = typeof tradedCount?.traded === "number" ? tradedCount.traded : trades.length;
  const avgTradeSize = trades.length > 0 ? tradeVolume / trades.length : 0;

  // Account age: prefer the explicit profile.createdAt from Gamma (the real
  // account creation date). Fall back to the oldest record we can find.
  const createdAtTs = profile?.createdAt ? Math.floor(new Date(profile.createdAt).getTime() / 1000) : Infinity;
  const oldestTs = Math.min(
    createdAtTs,
    oldestTrade?.[0]?.timestamp ?? Infinity,
    oldestActivity?.[0]?.timestamp ?? Infinity,
    trades.length ? Math.min(...trades.map((t) => t.timestamp)) : Infinity,
    activity.length ? Math.min(...activity.map((a) => a.timestamp)) : Infinity
  );
  const accountAgeDays = Number.isFinite(oldestTs)
    ? Math.max(0, Math.floor((Date.now() / 1000 - oldestTs) / 86400))
    : 0;

  // Active weeks: derive from trade timestamps
  const tradeTimestamps = trades.map((t) => t.timestamp);
  const consecutiveActiveWeeks = longestConsecutiveWeeks(tradeTimestamps);

  // Active days, idle metrics
  const activeDaySet = new Set<string>();
  for (const t of trades) {
    const d = new Date(t.timestamp * 1000);
    activeDaySet.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
  }
  const activeDays = activeDaySet.size;
  const nowSec = Math.floor(Date.now() / 1000);
  const latestTradeTs = tradeTimestamps.length ? Math.max(...tradeTimestamps) : 0;
  const daysSinceLastTrade = latestTradeTs > 0 ? Math.floor((nowSec - latestTradeTs) / 86400) : 0;
  let longestIdleStretch = 0;
  if (tradeTimestamps.length > 1) {
    const sorted = [...tradeTimestamps].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.floor((sorted[i] - sorted[i - 1]) / 86400);
      if (gap > longestIdleStretch) longestIdleStretch = gap;
    }
  }

  // Category diversity
  const cats = new Set<string>();
  for (const t of trades) cats.add(inferCategory(t.slug, t.eventSlug));
  cats.delete("other");
  const categoryDiversity = cats.size;

  // LP rewards from activity entries of type REWARD
  const lpRewards = activity
    .filter((a) => a.type === "REWARD")
    .reduce((acc, a) => acc + (a.usdcSize ?? 0), 0);

  return {
    address: addr,
    proxyWallet,
    weightedVolume,
    pnl,
    profitOnly: Math.max(0, pnl),
    lpRewards,
    totalPredictions: tradeCount,
    accountAgeDays,
    consecutiveActiveWeeks,
    categoryDiversity,
    avgTradeSize,
    activeDays,
    daysSinceLastTrade,
    longestIdleStretch,
  };
}
