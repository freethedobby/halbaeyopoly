"use client";

import { useEffect, useMemo, useState } from "react";
import type { Economics, ScoreRow, WalletStats, Weights } from "@/lib/scoring";
import {
  score,
  DEFAULT_WEIGHTS,
  DEFAULT_ECONOMICS,
  ECONOMICS_CONFIG,
  SLIDER_CONFIG,
  TOTAL_SUPPLY,
  getTier,
  scaledTiers,
  airdropSupply,
  tokenPriceUsd,
  ELIGIBLE_WALLET_COUNT,
  TRACKED_WALLET_COUNT,
} from "@/lib/scoring";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const fmt0 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPrice = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);
const fmtFdv = (n: number) => `$${(n / 1e9).toFixed(1)}B`;

type Tab = "breakdown" | "weights" | "economics" | "social";

export default function HomePage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<WalletStats | null>(null);

  const [xConnected, setXConnected] = useState(true);
  const [profileViews, setProfileViews] = useState(0);
  const [referrals, setReferrals] = useState(0);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [economics, setEconomics] = useState<Economics>(DEFAULT_ECONOMICS);
  const [tab, setTab] = useState<Tab>("breakdown");
  const [logoWiggle, setLogoWiggle] = useState(false);
  const [donateToast, setDonateToast] = useState(false);
  const [hasClickedLogo, setHasClickedLogo] = useState(false);
  const [tips, setTips] = useState<{ totalUsd: number; ethAmount: number; usdcAmount: number; usdtAmount: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/tips")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && !j.error && setTips(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function copyDonation() {
    try {
      await navigator.clipboard.writeText(ETH_ADDRESS);
    } catch {
      // clipboard may be blocked — animate anyway
    }
    setLogoWiggle(true);
    setDonateToast(true);
    setHasClickedLogo(true);
    setTimeout(() => setLogoWiggle(false), 650);
    setTimeout(() => setDonateToast(false), 2200);
  }

  const result = useMemo(
    () =>
      stats
        ? score(stats, { xConnected, profileViews, referralsInvited: referrals }, weights, economics)
        : null,
    [stats, xConnected, profileViews, referrals, weights, economics]
  );

  const tier = result && stats
    ? getTier(result.estimatedTokens, stats.weightedVolume, economics)
    : null;
  const isPaidTier = tier !== null && tier.minTokens > 0;
  const tiers = useMemo(() => scaledTiers(economics), [economics]);

  // Trigger a 5-second confetti burst whenever the user lands on a new tier.
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    if (tier) setBurstKey((k) => k + 1);
  }, [tier?.rank]);
  const supply = airdropSupply(economics);
  const price = tokenPriceUsd(economics);

  async function check() {
    setError(null);
    if (!ADDR_RE.test(address.trim())) {
      setError("Enter a valid 0x… wallet address (40 hex chars).");
      return;
    }
    setLoading(true);
    setStats(null);
    try {
      const res = await fetch(`/api/wallet?address=${address.trim().toLowerCase()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      setStats(json as WalletStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <StarField tier={tier?.rank ?? null} key={`${tier?.rank ?? "none"}-${burstKey}`} />
    <main className="relative z-10 mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={copyDonation}
            title="Click to copy ETH donation address"
            aria-label="Copy ETH donation address"
            className="group relative inline-flex h-16 w-16 shrink-0 items-center justify-center sm:h-20 sm:w-20"
          >
            <img
              src="/logo.png"
              alt="Logo — click to donate ETH"
              className={`h-16 w-16 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-20 sm:w-20 ${
                logoWiggle ? "logo-wiggle" : !hasClickedLogo && !donateToast ? "logo-idle-pulse" : ""
              }`}
            />
            {!hasClickedLogo && !donateToast && (
              <span className="click-hint pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap">
                <span className="relative inline-block border-2 border-white bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-black shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
                  Click me ↓
                  <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white bg-white"></span>
                </span>
              </span>
            )}
            {donateToast && (
              <>
                <span className="tip-pop absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap border border-white bg-white px-3 py-1 text-xs font-black uppercase tracking-widest text-black">
                  Tip me!
                </span>
                <span className="toast-in absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap border border-white bg-black px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                  ETH address copied
                </span>
              </>
            )}
          </button>
          <div className="group relative min-w-0">
            <h1
              tabIndex={0}
              className="cursor-help text-xl font-bold uppercase leading-tight tracking-tight underline decoration-dotted decoration-white/30 underline-offset-[6px] hover:decoration-white focus:decoration-white focus:outline-none sm:text-3xl sm:leading-normal"
            >
              Polymarket Airdrop Calculator
            </h1>
            <div className="pointer-events-none absolute left-0 top-full z-30 mt-3 w-[min(28rem,calc(100vw-1.5rem))] border border-white bg-black p-4 opacity-0 shadow-[0_8px_30px_-10px_rgba(255,255,255,0.25)] transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
              <p className="text-sm leading-relaxed text-muted">
                Hyperliquid-style point system over Polymarket on-chain activity. Tier breakpoints
                come from HYPE&apos;s genesis distribution percentiles, scaled to $POLY.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Built by{" "}
                <a
                  href="https://x.com/Dobbyisbad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
                >
                  @halbaeyo
                </a>
                {" "}— if this helped, tap the logo to copy my ETH tip address, or sign up on
                Polymarket with my referral.
              </p>
            </div>
          </div>
        </div>

        <nav className="flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          <TipsBadge tips={tips} />
          <IconLink
            href="https://polymarket.com/@halbaeyo"
            label="Developer profile"
            title="Visit @halbaeyo's Polymarket profile"
          >
            <PolymarketMark />
          </IconLink>
          <IconLink
            href="https://polymarket.com/?r=halbaeyo"
            label="Join the market"
            title="Sign up on Polymarket with my referral"
          >
            <PolymarketMark />
          </IconLink>
          <IconOnly
            href="https://x.com/Dobbyisbad"
            title="Follow @Dobbyisbad on X"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
            </svg>
          </IconOnly>
        </nav>
      </header>

      <DDayStrip />

      {/* WALLET INPUT */}
      <section className="mb-8 border border-white p-4 sm:p-5">
        <label className="text-xs uppercase tracking-widest text-muted">Polymarket wallet</label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
            inputMode="text"
            className="min-w-0 flex-1 border border-white bg-black px-4 py-3 text-base outline-none focus:bg-white focus:text-black"
            spellCheck={false}
            autoComplete="off"
            onKeyDown={(e) => e.key === "Enter" && check()}
          />
          <button
            onClick={check}
            disabled={loading}
            className="border border-white bg-white px-6 py-3 text-sm font-semibold uppercase tracking-wider text-black hover:bg-black hover:text-white disabled:opacity-50"
          >
            {loading ? "…" : "Check"}
          </button>
        </div>
        {error && <div className="mt-3 text-sm text-white">{error}</div>}
      </section>

      {/* RESULT PANEL — pinned */}
      <section className="relative mb-2 border border-white">
        {loading && <div className="dimmer" />}
        <div className="flex items-center justify-between border-b border-white px-5 py-2 text-[10px] uppercase tracking-widest text-muted">
          <span>Result</span>
          {result && (
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                isPaidTier
                  ? "border border-white bg-white text-black"
                  : "border border-white/40 text-muted"
              }`}
            >
              {tier
                ? isPaidTier
                  ? `✓ ${tier.rank} — eligible`
                  : `${tier.rank} — tracked (0 $POLY)`
                : "✗ Not eligible"}
            </span>
          )}
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-1 border-b border-white md:grid-cols-4">
          <StatCard
            label="Estimated tokens"
            valueNode={result ? <CountUp value={result.estimatedTokens} format={fmt0} className="value-pop" /> : "—"}
            sub="$POLY"
          />
          <StatCard
            label="Estimated value"
            valueNode={result ? <CountUp value={result.estimatedValueUsd} format={fmtUsd} className="value-pop" /> : "—"}
            sub={`@ ${fmtPrice(price)}/token`}
            borderLeft
          />
          <StatCard
            label="Total points"
            valueNode={result ? <CountUp value={result.totalPoints} format={fmt0} className="value-pop" /> : "—"}
            sub={result ? `${result.poolSharePct.toFixed(4)}% of pool` : "—"}
            borderLeft
          />
          <StatCard
            label="Tier"
            valueNode={
              result ? (
                tier ? (
                  <span className="value-pop inline-flex items-baseline gap-2">
                    {tier.rank}
                    <span
                      title="Points-based tier. Whale and Pro receive $POLY. Trader and Contributor are tracked but earn 0 under the current top-30%-only payout. Drag the Weights tab to model different formulas."
                      className="cursor-help border border-white/40 px-1.5 text-[10px] font-normal text-muted hover:text-white"
                    >
                      ?
                    </span>
                  </span>
                ) : (
                  <span className="value-pop text-2xl text-white/70">Not eligible</span>
                )
              ) : (
                "—"
              )
            }
            sub={
              result && stats
                ? isPaidTier
                  ? `Eligible · ≥ ${fmtUsd(tier!.minVolumeUsd)} volume`
                  : tier
                    ? `Tracked · need ${fmtUsd(tiers[1].minVolumeUsd)} vol to pay`
                    : `Below ${fmtUsd(tiers[tiers.length - 1].minVolumeUsd)} volume floor`
                : "—"
            }
            borderLeft
          />
        </div>

        {/* Tier table — desktop header (hidden on mobile) */}
        <div className="hidden border-b border-white px-5 py-3 text-xs uppercase tracking-widest text-muted sm:grid sm:grid-cols-[1.2fr_1.1fr_1fr_1fr_1fr]">
          <div>Tier</div>
          <div className="text-right">Min volume</div>
          <div className="text-right">Min $POLY</div>
          <div className="text-right">Median $POLY</div>
          <div className="text-right">Max $POLY</div>
        </div>
        {tiers.map((t, i) => {
          const isCurrent = tier?.rank === t.rank;
          const paid = t.minTokens > 0;
          return (
            <div
              key={t.rank}
              className={`px-4 py-4 sm:grid sm:grid-cols-[1.2fr_1.1fr_1fr_1fr_1fr] sm:items-center sm:px-5 ${
                i < tiers.length - 1 ? "border-b border-white/30" : ""
              } ${
                isCurrent
                  ? "relative z-10 -my-px scale-[1.01] bg-white text-black shadow-[0_0_0_2px_white,inset_0_0_0_1px_black]"
                  : ""
              }`}
            >
              <div className={`${isCurrent ? "text-base font-bold uppercase" : "font-semibold"} text-sm sm:text-base`}>
                {isCurrent && <span className="mr-2">▶</span>}
                {t.rank}
                {isCurrent && (
                  <span className="ml-2 border border-black bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white sm:text-xs">
                    You
                  </span>
                )}
                {!paid && (
                  <span className="ml-2 text-[10px] uppercase tracking-widest text-muted">tracked</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:hidden">
                <div className="text-muted">Min vol</div>
                <div className="text-right">{fmtUsd(t.minVolumeUsd)}</div>
                <div className="text-muted">Min</div>
                <div className="text-right">{paid ? fmt0(t.minTokens) : "—"}</div>
                <div className="text-muted">Median</div>
                <div className={`text-right ${isCurrent ? "font-bold" : ""}`}>{paid ? fmt0(t.medianTokens) : "—"}</div>
                <div className="text-muted">Max</div>
                <div className="text-right">{paid ? fmt0(t.maxTokens) : "—"}</div>
              </div>
              <div className="hidden text-right sm:block">{fmtUsd(t.minVolumeUsd)}</div>
              <div className="hidden text-right sm:block">{paid ? fmt0(t.minTokens) : "—"}</div>
              <div className={`hidden text-right sm:block ${isCurrent ? "font-bold" : ""}`}>{paid ? fmt0(t.medianTokens) : "—"}</div>
              <div className="hidden text-right sm:block">{paid ? fmt0(t.maxTokens) : "—"}</div>
            </div>
          );
        })}
      </section>

      {/* TAB STRIP */}
      <section className="border border-white">
        <div className="grid grid-cols-4 border-b border-white">
          {(["breakdown", "weights", "economics", "social"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-3 text-[10px] uppercase tracking-widest transition sm:px-5 sm:py-4 sm:text-xs ${
                tab === t ? "bg-white text-black" : "text-muted hover:text-white"
              } ${t !== "social" ? "border-r border-white" : ""}`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-5">
          {tab === "breakdown" && <BreakdownPanel rows={result?.rows ?? placeholderRows()} />}
          {tab === "weights" && (
            <WeightsPanel weights={weights} onChange={setWeights} onReset={() => setWeights(DEFAULT_WEIGHTS)} />
          )}
          {tab === "economics" && (
            <EconomicsPanel
              economics={economics}
              onChange={setEconomics}
              onReset={() => setEconomics(DEFAULT_ECONOMICS)}
              supply={supply}
              price={price}
            />
          )}
          {tab === "social" && (
            <SocialPanel
              xConnected={xConnected}
              setXConnected={setXConnected}
              xMultiplier={weights.xMultiplier}
              profileViews={profileViews}
              setProfileViews={setProfileViews}
              referrals={referrals}
              setReferrals={setReferrals}
            />
          )}
        </div>
      </section>

      <footer className="mt-10 text-xs text-muted">
        Live data from data-api.polymarket.com. Tier thresholds derived from Hyperliquid HYPE
        genesis distribution (min 0.11, p50 64.4, p99 58,318, max 1.97M HYPE), scaled to a
        hypothetical $POLY airdrop. $POLY has not launched — estimate only.
      </footer>
    </main>
    </>
  );
}

const TIER_STARS: Record<string, { count: number; palette: string[]; sizeRange: [number, number] }> = {
  "Top 0.1%": { count: 260, palette: ["#ffd76a", "#f5a623", "#fff2c2", "#ffaa00", "#ff7e00"], sizeRange: [3, 10] },
  "Top 10%":  { count: 140, palette: ["#e2e6ee", "#a9b1c4", "#d6dbe6", "#9aa3bd"], sizeRange: [2, 6] },
  "Top 30%":  { count: 75,  palette: ["#8aa3e8", "#6082dc", "#5b9bd5"], sizeRange: [2, 5] },
  "Novice":   { count: 35,  palette: ["#555c70", "#4d556e"], sizeRange: [2, 4] },
};
const DEFAULT_STARS = { count: 40, palette: ["#6b7390", "#4d556e", "#5b6a8a"], sizeRange: [2, 4] as [number, number] };

function StarField({ tier }: { tier: string | null }) {
  const cfg = tier ? TIER_STARS[tier] ?? DEFAULT_STARS : DEFAULT_STARS;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stars = useMemo(() => {
    if (!mounted) return [];
    const out: Array<{
      top: number; left: number; size: number; color: string; delay: number; duration: number;
    }> = [];
    for (let i = 0; i < cfg.count; i++) {
      out.push({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: cfg.sizeRange[0] + Math.random() * (cfg.sizeRange[1] - cfg.sizeRange[0]),
        color: cfg.palette[Math.floor(Math.random() * cfg.palette.length)],
        delay: -Math.random() * 3,
        duration: 2 + Math.random() * 3,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, mounted]);

  // Server render = empty container (no random output), so SSR markup matches
  // the first client render. Stars populate after the mount effect runs.
  return (
    <div className="star-bg" aria-hidden suppressHydrationWarning>
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: s.color,
            boxShadow: `0 0 ${s.size * 1.5}px ${s.color}`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function tabLabel(t: Tab): string {
  switch (t) {
    case "breakdown":
      return "Breakdown";
    case "weights":
      return "Weights";
    case "economics":
      return "Economics";
    case "social":
      return "Social";
  }
}

const ETH_ADDRESS = "0xeB26869ac8B9F9EE306327D460953453832A8810";

type KeyDate = {
  label: string;
  iso: string; // YYYY-MM-DD
  note: string;
  wave: 1 | 2;
  highlight?: boolean;
};

// TODO: paste the real "two-wave" X thesis URL once posted.
const THESIS_TWO_WAVE_URL = "https://x.com/Dobbyisbad";
const THESIS_JULY9_URL = "https://x.com/Dobbyisbad/status/2056008919945027755?s=20";

// Wave 1: loyalty drop tied to the World Cup window (Mustafa's calendar dot).
// Wave 2: "large future rewards" — new season catching post-WC + Midterms wallets.
const KEY_DATES: KeyDate[] = [
  { label: "World Cup R16",     iso: "2026-07-07", note: "Round of 16 kicks off.", wave: 1 },
  { label: "$POLY TGE",         iso: "2026-07-09", note: "Predicted Wave 1 drop — World Cup rest day between R16 and QFs. Calendar dot on Mustafa's blurred desk shot.", wave: 1, highlight: true },
  { label: "World Cup Final",   iso: "2026-07-19", note: "Tournament wraps.", wave: 1 },
  { label: "Wave 2 season",     iso: "2026-11-01", note: "Predicted new farming season around the US Midterms — catches the post-WC flood on the new wV system.", wave: 2, highlight: true },
  { label: "US Midterms",       iso: "2026-11-03", note: "Largest political-prediction event of the year.", wave: 2 },
];

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

function DDayStrip() {
  const [open, setOpen] = useState(false);
  const wave1 = KEY_DATES.filter((d) => d.wave === 1).sort((a, b) => a.iso.localeCompare(b.iso));
  const wave2 = KEY_DATES.filter((d) => d.wave === 2).sort((a, b) => a.iso.localeCompare(b.iso));
  const headlineDays = daysUntil("2026-07-09");
  const headlineLabel = headlineDays < 0 ? "PAST" : `D-${headlineDays}`;

  return (
    <section className="mb-8 space-y-2">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border border-white/30 px-3 py-2 text-left text-xs uppercase tracking-widest text-muted hover:text-white sm:px-4"
      >
        <span className="truncate">
          <span className="font-bold text-white">Timeline</span> · $POLY TGE{" "}
          <span className="text-white">{headlineLabel}</span> · two-wave thesis
        </span>
        <span className="text-white">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-2">
          <WaveTimeline
            title="Wave 1 · Loyalty drop"
            sub="~15–20% of supply · paid on weighted volume (wV)"
            dates={wave1}
          />
          <WaveTimeline
            title="Wave 2 · New season"
            sub="~10–15% of supply · the “large future rewards” Mustafa dangled"
            dates={wave2}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-muted">
            <span>
              Combined call: <span className="text-white">~25–35% of supply</span> — land-grab
              ahead of Kalshi and the US relaunch.
            </span>
            <span className="flex gap-3">
              <a
                href={THESIS_JULY9_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white"
              >
                ▶ Why July 9?
              </a>
              <a
                href={THESIS_TWO_WAVE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white"
              >
                ▶ Two-wave thesis
              </a>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function WaveTimeline({
  title,
  sub,
  dates,
}: {
  title: string;
  sub: string;
  dates: KeyDate[];
}) {
  const cols = Math.max(dates.length, 1);
  return (
    <div className="border border-white/30 px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white sm:text-xs">
          {title}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted sm:text-[10px]">
          {sub}
        </span>
      </div>
      <div className="relative px-1 py-2">
        <div className="absolute left-1 right-1 top-1/2 h-px -translate-y-1/2 bg-white/30" />
        <div
          className="relative grid gap-1"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {dates.map((d) => {
            const days = daysUntil(d.iso);
            const passed = days < 0;
            const fmt = new Date(d.iso + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return (
              <div key={d.iso} title={d.note} className="flex flex-col items-center text-center leading-tight">
                <div className="text-[8px] font-semibold uppercase tracking-widest text-muted sm:text-[9px]">
                  {d.label}
                </div>
                <div
                  className={`my-1 h-2 w-2 rotate-45 border ${
                    d.highlight ? "border-white bg-white" : "border-white/60 bg-bg"
                  }`}
                />
                <div
                  className={`text-xs font-bold sm:text-sm ${
                    d.highlight ? "text-white" : "text-white/80"
                  }`}
                >
                  {passed ? "PAST" : `D-${days}`}
                </div>
                <div className="text-[8px] uppercase tracking-widest text-muted sm:text-[9px]">
                  {fmt}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TipsBadge({
  tips,
}: {
  tips: { totalUsd: number; ethAmount: number; usdcAmount: number; usdtAmount: number } | null;
}) {
  const tooltip = tips
    ? `${tips.ethAmount.toFixed(4)} ETH · ${(tips.usdcAmount + tips.usdtAmount).toFixed(2)} USDC/USDT`
    : "Loading on-chain tip total…";
  return (
    <div
      title={tooltip}
      className="flex items-center gap-2 border border-white bg-black px-3 py-2 text-xs uppercase tracking-widest"
    >
      <span className="text-muted">Tips</span>
      <span className="font-bold text-white">
        {tips ? `$${tips.totalUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
      </span>
    </div>
  );
}

function PolymarketMark() {
  // The black-and-white Polymarket mark. We rely on filter:invert when the
  // surrounding button flips background-on-hover so the mark stays readable.
  return (
    <img
      src="/polymarket.png"
      alt="Polymarket"
      className="h-4 w-4 object-contain invert group-hover:invert-0"
    />
  );
}

function IconOnly({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className="group flex h-9 w-9 items-center justify-center border border-white hover:bg-white hover:text-black"
    >
      {children}
    </a>
  );
}

function IconLink({
  href,
  label,
  title,
  children,
}: {
  href: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="group flex items-center gap-2 border border-white px-3 py-2 text-xs uppercase tracking-widest hover:bg-white hover:text-black"
    >
      {children}
      <span>{label}</span>
    </a>
  );
}

function useAnimatedNumber(target: number, durationMs = 700): number {
  const [val, setVal] = useState(target);
  const startRef = useMemo(() => ({ from: 0, t0: 0, to: target }), [target]);
  useEffect(() => {
    startRef.from = val;
    startRef.to = target;
    startRef.t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - startRef.t0) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      const v = startRef.from + (startRef.to - startRef.from) * eased;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);
  return val;
}

function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const animated = useAnimatedNumber(value);
  return <span className={className}>{format(animated)}</span>;
}

function StatCard({
  label,
  valueNode,
  sub,
  borderLeft,
}: {
  label: string;
  valueNode: React.ReactNode;
  sub: string;
  borderLeft?: boolean;
}) {
  return (
    <div className={`p-4 sm:p-5 ${borderLeft ? "border-t border-white md:border-l md:border-t-0" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold sm:mt-3 sm:text-3xl">{valueNode}</div>
      <div className="mt-2 text-xs text-muted">{sub}</div>
    </div>
  );
}

function BreakdownPanel({ rows }: { rows: ScoreRow[] }) {
  return (
    <div>
      <div className="hidden border-b border-white pb-3 text-xs uppercase tracking-widest text-muted sm:grid sm:grid-cols-[1.6fr_1fr_1fr_0.7fr]">
        <div>Component</div>
        <div className="text-right">Input</div>
        <div className="text-right">Weight</div>
        <div className="text-right">Points</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`py-3 text-sm sm:grid sm:grid-cols-[1.6fr_1fr_1fr_0.7fr] sm:items-center ${
            i < rows.length - 1 ? "border-b border-white/30" : ""
          }`}
        >
          <div className="font-semibold sm:font-normal">{r.label}</div>
          {/* Mobile row */}
          <div className="mt-1 flex items-baseline justify-between text-xs sm:hidden">
            <span className="text-muted">{r.input} · {r.weight}</span>
            <span className="font-semibold">
              {r.isMultiplier ? (r.points > 0 ? `+${fmt0(r.points)}` : "—") : fmt0(r.points)}
            </span>
          </div>
          <div className="hidden text-right sm:block">{r.input}</div>
          <div className="hidden text-right text-muted sm:block">{r.weight}</div>
          <div className="hidden text-right sm:block">
            {r.isMultiplier ? (r.points > 0 ? `+${fmt0(r.points)}` : "—") : fmt0(r.points)}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeightsPanel({
  weights,
  onChange,
  onReset,
}: {
  weights: Weights;
  onChange: (w: Weights) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div className="text-xs text-muted">
          Polymarket-skewed defaults: rewards <span className="text-white">activity & retention</span>{" "}
          over whales or lucky PnL.
        </div>
        <button
          onClick={onReset}
          className="border border-white px-3 py-1 text-xs uppercase tracking-wider hover:bg-white hover:text-black"
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(Object.keys(SLIDER_CONFIG) as Array<keyof Weights>).map((k) => {
          const cfg = SLIDER_CONFIG[k];
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between text-xs text-muted">
                <span>{cfg.label}</span>
                <span className="font-semibold text-white">{weights[k].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={weights[k]}
                onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) })}
                className="mt-2 w-full accent-white"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EconomicsPanel({
  economics,
  onChange,
  onReset,
  supply,
  price,
}: {
  economics: Economics;
  onChange: (e: Economics) => void;
  onReset: () => void;
  supply: number;
  price: number;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div className="text-xs text-muted">
          Hypothetical airdrop size and valuation. All tier thresholds scale with these.
        </div>
        <button
          onClick={onReset}
          className="border border-white px-3 py-1 text-xs uppercase tracking-wider hover:bg-white hover:text-black"
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between text-xs text-muted">
            <span>{ECONOMICS_CONFIG.airdropPct.label}</span>
            <span className="font-semibold text-white">
              {economics.airdropPct.toFixed(1)}% · {fmt0(supply)} $POLY
            </span>
          </div>
          <input
            type="range"
            min={ECONOMICS_CONFIG.airdropPct.min}
            max={ECONOMICS_CONFIG.airdropPct.max}
            step={ECONOMICS_CONFIG.airdropPct.step}
            value={economics.airdropPct}
            onChange={(e) => onChange({ ...economics, airdropPct: Number(e.target.value) })}
            className="mt-2 w-full accent-white"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-muted">
            <span>5%</span>
            <span>of {fmt0(TOTAL_SUPPLY)} total</span>
            <span>35%</span>
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-xs text-muted">
            <span>{ECONOMICS_CONFIG.fdvUsd.label}</span>
            <span className="font-semibold text-white">
              {fmtFdv(economics.fdvUsd)} · {fmtPrice(price)}/token
            </span>
          </div>
          <input
            type="range"
            min={ECONOMICS_CONFIG.fdvUsd.min}
            max={ECONOMICS_CONFIG.fdvUsd.max}
            step={ECONOMICS_CONFIG.fdvUsd.step}
            value={economics.fdvUsd}
            onChange={(e) => onChange({ ...economics, fdvUsd: Number(e.target.value) })}
            className="mt-2 w-full accent-white"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-muted">
            <span>$5B</span>
            <span>FDV</span>
            <span>$100B</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialPanel({
  xConnected,
  setXConnected,
  xMultiplier,
  profileViews,
  setProfileViews,
  referrals,
  setReferrals,
}: {
  xConnected: boolean;
  setXConnected: (v: boolean) => void;
  xMultiplier: number;
  profileViews: number;
  setProfileViews: (n: number) => void;
  referrals: number;
  setReferrals: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted">X / Twitter connected</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-muted">+{Math.round((xMultiplier - 1) * 100)}% multiplier</div>
          <button
            onClick={() => setXConnected(!xConnected)}
            aria-pressed={xConnected}
            className={`relative h-7 w-12 border border-white ${xConnected ? "bg-white" : "bg-black"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 transition ${
                xConnected ? "left-6 bg-black" : "left-0.5 bg-white"
              }`}
            />
          </button>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted">Profile views</div>
        <input
          type="number"
          min={0}
          value={profileViews}
          onChange={(e) => setProfileViews(Math.max(0, Number(e.target.value) || 0))}
          className="mt-3 w-full border border-white bg-black px-3 py-2 outline-none focus:bg-white focus:text-black"
        />
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted">Referrals invited</div>
        <input
          type="number"
          min={0}
          value={referrals}
          onChange={(e) => setReferrals(Math.max(0, Number(e.target.value) || 0))}
          className="mt-3 w-full border border-white bg-black px-3 py-2 outline-none focus:bg-white focus:text-black"
        />
      </div>
    </div>
  );
}

function placeholderRows(): ScoreRow[] {
  const w = DEFAULT_WEIGHTS;
  return [
    { key: "weightedVolume",        label: "Weighted volume",     input: "—", weight: `×${w.weightedVolume.toFixed(2)}`, points: 0 },
    { key: "profitOnly",            label: "PnL (profit only)",   input: "—", weight: `×${w.profitOnly.toFixed(2)}`,     points: 0 },
    { key: "lpRewards",             label: "LP rewards",          input: "—", weight: `×${w.lpRewards.toFixed(2)}`,      points: 0 },
    { key: "perPrediction",         label: "Markets traded",      input: "—", weight: `×${w.perPrediction}/market`,      points: 0 },
    { key: "perAccountAgeDay",      label: "Account age",         input: "—", weight: `×${w.perAccountAgeDay}/day`,      points: 0 },
    { key: "perProfileView",        label: "Profile views",       input: "—", weight: `×${w.perProfileView}/view`,       points: 0 },
    { key: "perReferral",           label: "Referrals invited",   input: "—", weight: `×${w.perReferral}/ref`,           points: 0 },
    { key: "perConsecutiveWeek",    label: "Consecutive weeks",   input: "—", weight: `×${w.perConsecutiveWeek}/wk`,     points: 0 },
    { key: "perCategory",           label: "Category diversity",  input: "—", weight: `×${w.perCategory}/cat`,           points: 0 },
    { key: "perAvgTradeSizeDollar", label: "Avg $ per market",    input: "—", weight: `×${w.perAvgTradeSizeDollar}/$`,   points: 0 },
    { key: "perActiveDay",          label: "Active days",         input: "—", weight: `×${w.perActiveDay}/day`,          points: 0 },
    { key: "xMultiplier",           label: "X connected",         input: "—", weight: `×${w.xMultiplier.toFixed(2)}`,    points: 0, isMultiplier: true },
  ];
}
