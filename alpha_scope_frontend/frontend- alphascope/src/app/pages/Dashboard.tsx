import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  TrendingUp, TrendingDown, DollarSign,
  Activity, Brain, Bot, BarChart2, Bell,
} from "lucide-react";
import { getDashboardData, getAIRecommendations } from "../lib/api";
import { useTheme } from "../context/ThemeContext";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  StatCardSkeleton,
  TopHoldingsSkeleton,
  AIRecommendationSkeleton,
} from "../components/skeletons/Skeletons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopHolding {
  symbol: string;
  shares: number;
  current_price: number;
  purchase_price: number;
  pnl: number;
}

interface RecentTrade {
  symbol: string;
  trade_type: string;
  shares: number;
  price: number;
  total: number;
  executed_at: string;
}

interface DashboardData {
  portfolio_value: number;
  total_gain: number;
  total_gain_percent: number;
  paper_balance: number;
  active_alerts: number;
  triggered_today: number;
  top_holdings: TopHolding[];
  recent_trades: RecentTrade[];
}

interface SignalDetail {
  action: string;
  confidence: number;
  reasoning: string;
  status?: string;
}

interface AIRecommendation {
  symbol: string;
  price: number;
  rsi: number;
  rsi_signal: string;
  macd_signal: string;
  ma50_signal: string;
  recommendation: string;
  ml: SignalDetail;
  rl: SignalDetail;
  llm: SignalDetail;
  consensus: string;
  overall_confidence?: number;
  confidence_label?: string;
  vote_breakdown?: { BUY: number; SELL: number; HOLD: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function consensusCls(a: string) {
  if (a === "BUY")  return "text-green-400 bg-green-400/10 border border-green-400/20";
  if (a === "SELL") return "text-red-400 bg-red-400/10 border border-red-400/20";
  return "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20";
}

function signalCls(a: string) {
  if (a === "BUY")  return "text-green-400";
  if (a === "SELL") return "text-red-400";
  return "text-yellow-400";
}

function confidenceCls(label: string) {
  if (label === "High")   return "text-green-400";
  if (label === "Medium") return "text-yellow-400";
  return "text-slate-400";
}

function safePercent(value?: number) {
  if (value == null || isNaN(value)) return 0;
  return Math.round(value * 100);
}

// ─── Recent Trades Skeleton ───────────────────────────────────────────────────

function RecentTradesSkeleton() {
  return (
    <div className="divide-y divide-slate-800">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between py-3 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-5 rounded bg-slate-800" />
            <div className="space-y-1.5">
              <div className="w-12 h-4 rounded bg-slate-800" />
              <div className="w-24 h-3 rounded bg-slate-800" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <div className="w-16 h-4 rounded bg-slate-800 ml-auto" />
            <div className="w-20 h-3 rounded bg-slate-800 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { isDarkMode } = useTheme();

  const [data,        setData]        = useState<DashboardData | null>(null);
  const [aiRecs,      setAiRecs]      = useState<AIRecommendation[]>([]);
  const [loadingDash, setLoadingDash] = useState(true);
  const [loadingAI,   setLoadingAI]   = useState(true);

  useEffect(() => {
    getDashboardData()
      .then((d) => setData(d as DashboardData))
      .catch((e) => console.error("Dashboard fetch failed:", e))
      .finally(() => setLoadingDash(false));

    getAIRecommendations()
      .then((d) => { if (Array.isArray(d)) setAiRecs(d as AIRecommendation[]); })
      .catch((e) => console.error("AI fetch failed:", e))
      .finally(() => setLoadingAI(false));
  }, []);

  // ── Style tokens ──────────────────────────────────────────────────────────
  const card    = isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const inner   = isDarkMode ? "bg-slate-800/60"               : "bg-slate-100";
  const tp      = isDarkMode ? "text-white"                    : "text-slate-900";
  const ts      = isDarkMode ? "text-slate-400"                : "text-slate-500";
  const divider = isDarkMode ? "border-slate-700/50"           : "border-slate-200";

  return (
    <div className="space-y-4 pb-4">

      {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
      {/* Mobile: 2 columns | lg: 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loadingDash ? (
          [1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            {/* Portfolio Value */}
            <Card className={card}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${ts}`}>Portfolio Value</span>
                  <DollarSign className={`w-3.5 h-3.5 ${ts}`} />
                </div>
                <p className={`text-lg sm:text-xl font-bold ${tp} truncate`}>
                  ${data?.portfolio_value?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                </p>
                <p className={`text-xs mt-0.5 flex items-center gap-1 ${(data?.total_gain ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(data?.total_gain ?? 0) >= 0
                    ? <TrendingUp className="w-3 h-3 flex-shrink-0" />
                    : <TrendingDown className="w-3 h-3 flex-shrink-0" />}
                  <span className="truncate">{data?.total_gain_percent?.toFixed(2) ?? "0.00"}% total</span>
                </p>
              </CardContent>
            </Card>

            {/* Total Gain */}
            <Card className={card}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${ts} truncate`}>Gain / Loss</span>
                  <Activity className={`w-3.5 h-3.5 ${ts} flex-shrink-0`} />
                </div>
                <p className={`text-lg sm:text-xl font-bold truncate ${(data?.total_gain ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(data?.total_gain ?? 0) >= 0 ? "+" : ""}
                  ${data?.total_gain?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                </p>
                <p className={`text-xs mt-0.5 ${ts}`}>Since inception</p>
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card className={card}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${ts}`}>Active Alerts</span>
                  <Bell className={`w-3.5 h-3.5 ${ts} flex-shrink-0`} />
                </div>
                <p className={`text-lg sm:text-xl font-bold ${tp}`}>{data?.active_alerts ?? 0}</p>
                <p className="text-xs mt-0.5 text-blue-400">{data?.triggered_today ?? 0} triggered today</p>
              </CardContent>
            </Card>

            {/* Paper Balance */}
            <Card className={card}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${ts}`}>Paper Balance</span>
                  <DollarSign className={`w-3.5 h-3.5 ${ts} flex-shrink-0`} />
                </div>
                <p className={`text-lg sm:text-xl font-bold ${tp} truncate`}>
                  ${data?.paper_balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                </p>
                <p className={`text-xs mt-0.5 ${ts}`}>Available</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── HOLDINGS + AI ───────────────────────────────────────────────── */}
      {/* Mobile: stacked | lg: side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Holdings */}
        <Card className={card}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className={`text-sm font-semibold ${tp}`}>Top Holdings</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingDash ? (
              <TopHoldingsSkeleton />
            ) : !data?.top_holdings?.length ? (
              <p className={`text-center py-6 text-sm ${ts}`}>No holdings yet</p>
            ) : (
              <div className="space-y-1.5">
                {data.top_holdings.map((h) => (
                  <div
                    key={h.symbol}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${inner}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-400">{h.symbol[0]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${tp} truncate`}>{h.symbol}</p>
                        <p className={`text-xs ${ts}`}>{h.shares} shares</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className={`text-sm font-medium ${tp}`}>${h.current_price.toFixed(2)}</p>
                      <p className={`text-xs ${h.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card className={card}>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className={`text-sm font-semibold flex items-center gap-1.5 ${tp}`}>
                <Brain className="w-4 h-4 text-blue-400 flex-shrink-0" />
                AI Recommendations
              </CardTitle>
              {loadingAI && (
                <span className="text-xs text-slate-500 flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Analyzing…
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingAI ? (
              <AIRecommendationSkeleton />
            ) : !aiRecs.length ? (
              <p className={`text-center py-6 text-sm ${ts}`}>No recommendations</p>
            ) : (
              <div className="space-y-2">
                {aiRecs.map((rec) => {
                  const pct      = safePercent(rec.overall_confidence);
                  const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
                  const label    = rec.confidence_label ?? "Low";
                  return (
                    <div key={rec.symbol} className={`rounded-lg ${inner} px-3 py-2`}>

                      {/* Symbol row — wraps on very small screens */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-bold ${tp} flex-shrink-0`}>{rec.symbol}</span>
                          <span className={`text-xs ${ts} hidden sm:inline`}>${rec.price?.toFixed(2)}</span>
                          <span className={`text-xs ${ts} hidden sm:inline`}>RSI {rec.rsi?.toFixed(1)}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${consensusCls(rec.consensus)}`}>
                          {rec.consensus}
                        </span>
                      </div>

                      {/* Price + RSI visible on mobile below symbol */}
                      <div className="flex gap-2 mt-0.5 sm:hidden">
                        <span className={`text-xs ${ts}`}>${rec.price?.toFixed(2)}</span>
                        <span className={`text-xs ${ts}`}>RSI {rec.rsi?.toFixed(1)}</span>
                      </div>

                      {/* Confidence bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-1">
                          <div className={`${barColor} h-1 rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs flex-shrink-0 ${confidenceCls(label)}`}>{pct}%</span>
                      </div>

                      {/* ML / RL / LLM row — scrollable on very small screens */}
                      <div className={`flex items-center gap-2 sm:gap-3 mt-1.5 pt-1.5 border-t ${divider} overflow-x-auto`}>
                        {[
                          { label: "ML",  signal: rec.ml,  Icon: BarChart2 },
                          { label: "RL",  signal: rec.rl,  Icon: Activity  },
                          { label: "LLM", signal: rec.llm, Icon: Bot       },
                        ].map(({ label, signal, Icon }) => {
                          const err =
                            signal?.status === "error" ||
                            signal?.reasoning === "Insufficient data" ||
                            signal?.reasoning?.startsWith("Error");
                          return (
                            <div key={label} className={`flex items-center gap-1 flex-shrink-0 ${err ? "opacity-40" : ""}`}>
                              <Icon className="w-3 h-3 text-slate-500" />
                              <span className={`text-xs ${ts}`}>{label}</span>
                              <span className={`text-xs font-semibold ${signalCls(signal?.action)}`}>
                                {signal?.action}
                              </span>
                              <span className={`text-xs ${ts}`}>
                                {err ? "" : `${Math.round((signal?.confidence ?? 0) * 100)}%`}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── RECENT TRADES ───────────────────────────────────────────────── */}
      <Card className={card}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className={`text-sm font-semibold ${tp}`}>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loadingDash ? (
            <RecentTradesSkeleton />
          ) : !data?.recent_trades?.length ? (
            <p className={`text-center py-6 text-sm ${ts}`}>No trades yet</p>
          ) : (
            /* Scrollable table wrapper on small screens */
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className={`border-b ${divider}`}>
                    {["Type", "Symbol", "Shares", "Price", "Total", "Time"].map((h) => (
                      <th key={h} className={`text-left py-2 px-2 text-xs font-semibold ${ts} uppercase tracking-wide`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_trades.map((t, i) => (
                    <tr
                      key={i}
                      className={`border-b ${divider} last:border-0 hover:bg-slate-800/30 transition-colors`}
                    >
                      <td className="py-2.5 px-2">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          t.trade_type === "BUY"
                            ? "bg-green-400/10 text-green-400"
                            : "bg-red-400/10 text-red-400"
                        }`}>
                          {t.trade_type}
                        </span>
                      </td>
                      <td className={`py-2.5 px-2 font-semibold ${tp}`}>{t.symbol}</td>
                      <td className={`py-2.5 px-2 ${ts}`}>{t.shares}</td>
                      <td className={`py-2.5 px-2 ${ts}`}>${Number(t.price).toFixed(2)}</td>
                      <td className={`py-2.5 px-2 font-medium ${tp}`}>${Number(t.total).toFixed(2)}</td>
                      <td className={`py-2.5 px-2 ${ts} text-xs`}>{t.executed_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}