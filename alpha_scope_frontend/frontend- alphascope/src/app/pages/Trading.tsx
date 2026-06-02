import {
  useState, useCallback, useMemo,
  useEffect, useRef,
} from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  TrendingUp, TrendingDown, DollarSign,
  RefreshCw, Search, Loader2, BarChart2,
  ArrowUpRight, ArrowDownRight, Activity,
  Info, HelpCircle, X, ChevronDown, ChevronUp,
  Wallet, ShoppingCart, History,
  CandlestickChart as CandleIcon, LineChart as LineIcon,
  Wifi, WifiOff,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
  ComposedChart, Bar, Cell,
} from "recharts";
import { toast } from "sonner";
import { usePageTitle } from "../hooks/usePageTitle";
import { searchStocksAPI } from "../lib/api";

import {
  StockHeaderSkeleton,
  ChartSkeleton,
  IndicatorsSkeleton,
  AccountSkeleton,
  OrderFormSkeleton,
  HoldingsSkeleton,
} from "../components/skeletons/Skeletons";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE    = "http://localhost:8000/market";
const WS_BASE = "ws://127.0.0.1:8000";

const authHeaders = () => {
  const token = localStorage.getItem("jwt_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Candle {
  time: string; open: number; high: number;
  low: number; close: number; volume: number;
  livePrice?: number;
}
interface IndicatorsResponse {
  symbol: string; rsi: number; rsi_signal: string;
  macd: number; macd_signal: string;
  ma20: number; ma20_signal: string;
  ma50: number; ma50_signal: string;
}
interface StockResponse {
  price: number; symbol?: string; change?: number;
  change_pct?: number; name?: string; [key: string]: any;
}
interface SummaryResponse {
  paper_balance: number; holdings_value: number; total_value: number;
  total_pnl: number; total_bought: number; total_sold: number;
  total_trades: number; buy_trades: number; sell_trades: number;
}
interface TradeRecord {
  id: number; symbol: string; trade_type: "BUY" | "SELL";
  shares: number; price: number; total: number; timestamp: string;
}
interface HoldingRecord {
  symbol: string; shares: number; purchase_price: number; current_price: number;
}
interface SearchResult { symbol: string; name: string; }

const INTERVAL_LABELS: Record<string, string> = {
  "1D": "1D", "1W": "1W", "1M": "1M", "3M": "3M", "1Y": "1Y",
};

// ── Help Tooltip ──────────────────────────────────────────────────────────────
function HelpTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(v => !v)}
        className="text-slate-500 hover:text-slate-300 touch-manipulation"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute z-50 bottom-6 left-1/2 -translate-x-1/2 w-52 sm:w-60 bg-slate-800 border border-slate-600 rounded-xl p-3 text-xs text-slate-300 leading-relaxed shadow-xl">
          {text}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 border-r border-b border-slate-600 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ── Chart Tooltip ─────────────────────────────────────────────────────────────
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as Candle;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 sm:p-3 text-xs shadow-xl min-w-[140px] sm:min-w-[160px]">
      <p className="text-slate-400 mb-1.5 font-medium">{label}</p>
      <p className="text-white font-bold text-sm sm:text-base mb-1">
        ${Number(d?.livePrice ?? d?.close ?? 0).toFixed(2)}
        {d?.livePrice && <span className="text-xs ml-2 text-emerald-400 font-normal"> LIVE</span>}
      </p>
      {d?.open !== undefined && (
        <div className="space-y-0.5 text-slate-400">
          <p>Open:  <span className="text-white">${Number(d.open).toFixed(2)}</span></p>
          <p>High:  <span className="text-emerald-400">${Number(d.high).toFixed(2)}</span></p>
          <p>Low:   <span className="text-red-400">${Number(d.low).toFixed(2)}</span></p>
          <p>Close: <span className="text-white">${Number(d.close).toFixed(2)}</span></p>
          {d.volume > 0 && <p>Vol: <span className="text-white">{Number(d.volume).toLocaleString()}</span></p>}
        </div>
      )}
    </div>
  );
}

// ── Line Chart ────────────────────────────────────────────────────────────────
function LineChartView({ candles, livePrice }: { candles: Candle[]; livePrice: number | null }) {
  if (!candles.length) return (
    <div className="h-[260px] sm:h-[320px] lg:h-[400px] flex items-center justify-center text-slate-500 text-sm">No data</div>
  );
  const data = candles.map((c, i) =>
    i === candles.length - 1 && livePrice ? { ...c, livePrice, close: livePrice } : c
  );
  const first  = data[0]?.close ?? 0;
  const last   = data[data.length - 1]?.close ?? 0;
  const isUp   = last >= first;
  const color  = isUp ? "#34d399" : "#f87171";
  const gradId = isUp ? "upGrad" : "downGrad";
  return (
    <div className="h-[260px] sm:h-[320px] lg:h-[400px] pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f87171" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="time" stroke="#334155" tick={{ fontSize: 9, fill: "#64748b" }}
            tickFormatter={(v) => typeof v === "string" && v.includes(" ") ? v.split(" ")[1] : v}
            interval="preserveStartEnd" minTickGap={50} />
          <YAxis stroke="#334155" tick={{ fontSize: 9, fill: "#64748b" }}
            domain={["dataMin - 1", "dataMax + 1"]}
            tickFormatter={(v) => `$${Number(v).toFixed(0)}`} width={50} />
          <RechartsTooltip content={<ChartTooltipContent />} />
          <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2}
            fill={`url(#${gradId})`} dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Candlestick Chart ─────────────────────────────────────────────────────────
function CandlestickChartView({ candles, livePrice }: { candles: Candle[]; livePrice: number | null }) {
  if (!candles.length) return (
    <div className="h-[260px] sm:h-[320px] lg:h-[400px] flex items-center justify-center text-slate-500 text-sm">No data</div>
  );
  const data = candles.map((c, i) => {
    const close = i === candles.length - 1 && livePrice ? livePrice : c.close;
    return {
      ...c, close,
      livePrice: i === candles.length - 1 && livePrice ? livePrice : undefined,
      high: Math.max(c.high, close),
      low:  Math.min(c.low,  close),
      isUp: close >= c.open,
    };
  });
  const allPrices = data.flatMap(d => [d.high, d.low]);
  const minP = Math.min(...allPrices) - 1;
  const maxP = Math.max(...allPrices) + 1;

  const CandleShape = (props: any) => {
    const { x, width, height, y, payload } = props;
    if (!payload || width <= 0) return null;
    const isUp    = payload.isUp;
    const color   = isUp ? "#34d399" : "#f87171";
    const cx      = x + width / 2;
    const dom     = maxP - minP;
    const toY     = (p: number) => y + height * (maxP - p) / dom;
    const bodyT   = toY(Math.max(payload.open, payload.close));
    const bodyB   = toY(Math.min(payload.open, payload.close));
    const bodyH   = Math.max(bodyB - bodyT, 1);
    const candleW = Math.max(width * 0.6, 2);
    return (
      <g>
        <line x1={cx} y1={toY(payload.high)} x2={cx} y2={toY(payload.low)} stroke={color} strokeWidth={1.5} />
        <rect x={cx - candleW / 2} y={bodyT} width={candleW} height={bodyH}
          fill={color} fillOpacity={0.85} stroke={color} strokeWidth={1} rx={1} />
      </g>
    );
  };

  return (
    <div className="h-[260px] sm:h-[320px] lg:h-[400px] pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="time" stroke="#334155" tick={{ fontSize: 9, fill: "#64748b" }}
            tickFormatter={(v) => typeof v === "string" && v.includes(" ") ? v.split(" ")[1] : v}
            interval="preserveStartEnd" minTickGap={50} />
          <YAxis stroke="#334155" tick={{ fontSize: 9, fill: "#64748b" }}
            domain={[minP, maxP]} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} width={50} />
          <RechartsTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="high" shape={<CandleShape />} isAnimationActive={false}>
            {data.map((e, i) => <Cell key={i} fill={e.isUp ? "#34d399" : "#f87171"} />)}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Chart Container ───────────────────────────────────────────────────────────
function ChartContainer({ symbol, interval, chartStyle, livePrice }: {
  symbol: string; interval: string;
  chartStyle: "line" | "candle"; livePrice: number | null;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(false);
      try {
        const res = await apiFetch<{ data: Candle[] }>(
          `${BASE}/chart/${symbol}/?interval=${interval}`
        );
        const data = res?.data ?? [];
        if (data.length === 0) {
          const fallback = await apiFetch<{ data: Candle[] }>(
            `${BASE}/chart/${symbol}/?interval=${interval}&period=${interval.toLowerCase()}`
          ).catch(() => ({ data: [] as Candle[] }));
          setCandles(fallback.data ?? []);
        } else {
          setCandles(data);
        }
      } catch (e: any) {
        console.error(`Chart fetch failed for ${symbol} ${interval}:`, e.message);
        setError(true); setCandles([]);
      } finally { setLoading(false); }
    };
    load();
  }, [symbol, interval]);

  if (loading) return <ChartSkeleton />;
  if (error)   return (
    <div className="h-[260px] sm:h-[320px] lg:h-[400px] flex items-center justify-center text-slate-500 text-sm px-4 text-center">
      Could not load chart for {symbol}
    </div>
  );
  return chartStyle === "line"
    ? <LineChartView candles={candles} livePrice={livePrice} />
    : <CandlestickChartView candles={candles} livePrice={livePrice} />;
}

// ── RSI Gauge ─────────────────────────────────────────────────────────────────
function RsiGauge({ value }: { value: number }) {
  const pct   = Math.min(100, Math.max(0, value));
  const color = value < 35 ? "#34d399" : value > 65 ? "#f87171" : "#fbbf24";
  const label = value < 35 ? "Oversold — possible BUY"
              : value > 65 ? "Overbought — consider waiting"
              : "Neutral";
  return (
    <div className="space-y-3">
      <div className="relative h-3 rounded-full overflow-visible">
        <div className="absolute inset-0 rounded-full"
          style={{ background: "linear-gradient(to right,#34d399 0%,#fbbf24 50%,#f87171 100%)" }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-slate-900 shadow-lg transition-all duration-500"
          style={{ left: `calc(${pct}% - 8px)`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>0</span><span className="hidden sm:inline">Oversold</span>
        <span>35</span><span>65</span>
        <span className="hidden sm:inline">Overbought</span><span>100</span>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-xl sm:text-2xl font-bold text-white">{value.toFixed(1)}</span>
          <span className="text-slate-500 text-sm ml-2">/ 100</span>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ backgroundColor: color + "22", color }}>{label}</span>
      </div>
    </div>
  );
}

// ── Indicator Card ────────────────────────────────────────────────────────────
function IndicatorCard({ label, value, signal, tooltip, what }: {
  label: string; value: string; signal: string; tooltip: string; what: string;
}) {
  const s      = signal?.toLowerCase() ?? "";
  const isBull = s.includes("bull") || s.includes("above") || s === "oversold";
  const isBear = s.includes("bear") || s.includes("below") || s === "overbought";
  const color  = isBull ? "#34d399" : isBear ? "#f87171" : "#fbbf24";
  const Icon   = isBull ? ArrowUpRight : isBear ? ArrowDownRight : Activity;
  return (
    <div className="bg-slate-800/60 rounded-xl p-3 sm:p-4 border border-slate-700/30 space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{label}</p>
          <HelpTooltip text={tooltip} />
        </div>
        <span className="text-xs text-slate-500 hidden sm:inline">{what}</span>
      </div>
      <p className="text-lg sm:text-xl font-bold" style={{ color }}>{value}</p>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: color + "22", color }}>{signal}</span>
      </div>
    </div>
  );
}

// ── Paper Trading Info ────────────────────────────────────────────────────────
function PaperTradingInfo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left touch-manipulation">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="text-sm font-medium text-blue-300">What is Paper Trading?</span>
        <span className="ml-auto text-slate-500">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 text-xs text-slate-400 leading-relaxed border-t border-blue-500/10">
          <p className="mt-3"><strong className="text-slate-300">Paper trading</strong> = practice with <strong className="text-slate-300">virtual money</strong>.</p>
          <p>Start with <strong className="text-slate-300">$100,000 virtual cash</strong>.</p>
          <p><strong className="text-slate-300">BUY</strong> = you think price will go UP.</p>
          <p><strong className="text-slate-300">SELL</strong> = sell shares you already hold.</p>
          <p><strong className="text-slate-300">Live prices</strong> update via WebSocket every 15 seconds.</p>
          <p><strong className="text-slate-300">Reset Account</strong> to start fresh with $100,000.</p>
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Trading() {
  usePageTitle("Trading");
  const location      = useLocation();
  const initialSymbol = new URLSearchParams(location.search).get("symbol")?.toUpperCase() || "AAPL";

  const [symbol,            setSymbol]            = useState(initialSymbol);
  const [searchInput,       setSearchInput]       = useState(initialSymbol);
  const [quote,             setQuote]             = useState<StockResponse | null>(null);
  const [loadingQuote,      setLoadingQuote]      = useState(true);
  const [interval,          setInterval]          = useState("1M");
  const [chartStyle,        setChartStyle]        = useState<"line" | "candle">("line");
  const [indicators,        setIndicators]        = useState<IndicatorsResponse | null>(null);
  const [loadingIndicators, setLoadingIndicators] = useState(true);
  const [summary,           setSummary]           = useState<SummaryResponse | null>(null);
  const [trades,            setTrades]            = useState<TradeRecord[]>([]);
  const [holdings,          setHoldings]          = useState<HoldingRecord[]>([]);
  const [loadingSummary,    setLoadingSummary]    = useState(true);
  const [loadingHoldings,   setLoadingHoldings]   = useState(true);
  const [loadingTrades,     setLoadingTrades]     = useState(false);
  const [quantity,          setQuantity]          = useState("");
  const [placingTrade,      setPlacingTrade]      = useState(false);
  const [showHistory,       setShowHistory]       = useState(false);
  const [showIndicatorHelp, setShowIndicatorHelp] = useState(false);
  const [searchResults,     setSearchResults]     = useState<SearchResult[]>([]);
  const [searchLoading,     setSearchLoading]     = useState(false);
  const [livePrice,         setLivePrice]         = useState<number | null>(null);
  const [wsLive,            setWsLive]            = useState(false);
  // Mobile: show order panel as bottom sheet
  const [showOrderSheet,    setShowOrderSheet]    = useState(false);

  const wsRef          = useRef<WebSocket | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWS = useCallback((sym: string) => {
    wsRef.current?.close();
    setWsLive(false); setLivePrice(null);
    const ws = new WebSocket(`${WS_BASE}/ws/prices/?symbols=${sym}`);
    ws.onopen    = () => setWsLive(true);
    ws.onclose   = () => setWsLive(false);
    ws.onerror   = () => {};
    ws.onmessage = (e) => {
      try {
        const { symbol: s, price } = JSON.parse(e.data);
        if (s === sym) {
          const p = Number(price);
          setLivePrice(p);
          setQuote(prev => prev ? { ...prev, price: p } : prev);
        }
      } catch { /* ignore */ }
    };
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWS(symbol);
    return () => wsRef.current?.close();
  }, [symbol]); // eslint-disable-line

  useEffect(() => {
    const sym = new URLSearchParams(location.search).get("symbol")?.toUpperCase();
    if (sym && sym !== symbol) { setSymbol(sym); setSearchInput(sym); }
  }, [location.search]); // eslint-disable-line

  const fetchQuote = useCallback(async (sym: string) => {
    setLoadingQuote(true);
    try {
      const d = await apiFetch<StockResponse>(`${BASE}/stocks/${sym}/`);
      setQuote({ ...d, name: d.name ?? d.company_info?.name ?? sym });
    } catch { toast.error(`Could not load price for ${sym}`); }
    finally { setLoadingQuote(false); }
  }, []);

  const fetchIndicators = useCallback(async (sym: string) => {
    setLoadingIndicators(true);
    try { setIndicators(await apiFetch<IndicatorsResponse>(`${BASE}/indicators/${sym}/`)); }
    catch { setIndicators(null); }
    finally { setLoadingIndicators(false); }
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try { setSummary(await apiFetch<SummaryResponse>(`${BASE}/trades/summary/`)); }
    catch { }
    finally { setLoadingSummary(false); }
  }, []);

  const fetchTrades = useCallback(async () => {
    setLoadingTrades(true);
    try {
      const d = await apiFetch<TradeRecord[]>(`${BASE}/trades/`);
      setTrades(Array.isArray(d) ? d : []);
    } catch { }
    finally { setLoadingTrades(false); }
  }, []);

  const fetchHoldings = useCallback(async () => {
    setLoadingHoldings(true);
    try {
      const d = await apiFetch<HoldingRecord[]>(`${BASE}/trades/holdings/`);
      setHoldings(Array.isArray(d) ? d : []);
    } catch { }
    finally { setLoadingHoldings(false); }
  }, []);

  useEffect(() => {
    fetchQuote(symbol);
    fetchIndicators(symbol);
  }, [symbol]); // eslint-disable-line

  useEffect(() => {
    fetchSummary();
    fetchTrades();
    fetchHoldings();
  }, []); // eslint-disable-line

  const handleSearchInput = (val: string) => {
    setSearchInput(val); setSearchResults([]);
    if (!val.trim()) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await searchStocksAPI(val.trim());
        setSearchResults(Array.isArray(r) ? r.slice(0, 6) : []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
  };

  const handleSelectSymbol = (sym: string) => {
    setSearchInput(sym); setSearchResults([]); setSymbol(sym);
  };

  const handleSearch = () => {
    const sym = searchInput.trim().toUpperCase();
    if (sym) setSymbol(sym);
  };

  const handleTrade = useCallback(async (type: "BUY" | "SELL") => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast.error("Enter number of shares"); return; }
    setPlacingTrade(true);
    try {
      const res = await apiFetch<any>(`${BASE}/trades/place/`, {
        method: "POST",
        body:   JSON.stringify({ symbol, trade_type: type, shares: qty }),
      });
      toast.success(res.message ?? `${type} ${qty} shares of ${symbol}`);
      setQuantity("");
      setShowOrderSheet(false);
      if (res.paper_balance !== undefined)
        setSummary(p => p ? {
          ...p,
          paper_balance: res.paper_balance,
          total_value:   res.paper_balance + p.holdings_value,
        } : p);
      await Promise.all([fetchSummary(), fetchTrades(), fetchHoldings(), fetchQuote(symbol)]);
    } catch (e: any) { toast.error(`Trade failed: ${e.message}`); }
    finally { setPlacingTrade(false); }
  }, [quantity, symbol, fetchSummary, fetchTrades, fetchHoldings, fetchQuote]); // eslint-disable-line

  const handleReset = async () => {
    if (!confirm("Reset paper balance to $100,000?")) return;
    try {
      const res = await apiFetch<any>(`${BASE}/trades/reset/`, { method: "POST" });
      toast.success(res.message ?? "Reset to $100,000!");
      await Promise.all([fetchSummary(), fetchTrades(), fetchHoldings()]);
    } catch (e: any) { toast.error(e.message); }
  };

  const currentPrice   = livePrice ?? Number(quote?.price ?? 0);
  const estimatedTotal = useMemo(
    () => quantity && currentPrice ? parseFloat(quantity) * currentPrice : 0,
    [quantity, currentPrice]
  );
  const priceChange    = Number(quote?.change     ?? 0);
  const priceChangePct = Number(quote?.change_pct ?? 0);
  const isPositive     = priceChange >= 0;

  const holdingsWithPnl = holdings.map(h => ({
    ...h,
    pnl: (Number(h.current_price) - Number(h.purchase_price)) * Number(h.shares),
  }));

  const bullCount = indicators
    ? [indicators.macd_signal, indicators.ma20_signal, indicators.ma50_signal]
        .filter(s => s?.toLowerCase().includes("bull") || s?.toLowerCase().includes("above")).length
    : 0;
  const overallSignal = bullCount >= 2 ? "bullish" : bullCount === 0 ? "bearish" : "mixed";

  // ── Order form content (shared between sidebar and bottom sheet) ──────────
  const OrderFormContent = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          Number of Shares
          <HelpTooltip text="How many shares to buy or sell? Each costs the current price." />
        </Label>
        <Input type="number" min="1" step="1" value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="e.g. 5"
          className="bg-slate-800 border-slate-700 text-white text-lg font-bold" />
      </div>

      {currentPrice > 0 && (
        <div className="bg-slate-800/60 rounded-xl p-3 space-y-2 border border-slate-700/30 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Price per share</span>
            <span className="text-white font-medium">
              ${currentPrice.toFixed(2)}
              {livePrice && <span className="text-emerald-400 ml-1 text-xs font-semibold">LIVE</span>}
            </span>
          </div>
          {quantity && parseFloat(quantity) > 0 && (
            <div className="flex justify-between font-semibold">
              <span className="text-slate-400">{quantity} × ${currentPrice.toFixed(2)}</span>
              <span className="text-white">${estimatedTotal.toFixed(2)}</span>
            </div>
          )}
          {summary && (
            <div className="flex justify-between pt-2 border-t border-slate-700">
              <span className="text-slate-400">Cash available</span>
              <span className={`font-semibold ${
                estimatedTotal > summary.paper_balance ? "text-red-400" : "text-emerald-400"
              }`}>
                ${summary.paper_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      {summary && estimatedTotal > summary.paper_balance && estimatedTotal > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <X className="w-3.5 h-3.5" /> Not enough cash.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => handleTrade("BUY")}
          disabled={placingTrade || (!!summary && estimatedTotal > summary.paper_balance && estimatedTotal > 0)}
          className="py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2 touch-manipulation">
          {placingTrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <><TrendingUp className="w-4 h-4" /> BUY</>}
        </button>
        <button onClick={() => handleTrade("SELL")} disabled={placingTrade}
          className="py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-500 active:bg-red-700 text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2 touch-manipulation">
          {placingTrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <><TrendingDown className="w-4 h-4" /> SELL</>}
        </button>
      </div>

      <div className="space-y-1 text-xs text-slate-500">
        <p className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <strong className="text-emerald-400">BUY</strong> — you expect price to go UP
        </p>
        <p className="flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3 text-red-400" />
          <strong className="text-red-400">SELL</strong> — sell shares you already hold
        </p>
        <p className="text-slate-600 italic pt-1">Paper trading — no real money used.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4 pb-24 xl:pb-10">

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search symbol e.g. TSLA, Apple…"
            autoComplete="off"
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 rounded-xl border border-slate-700 shadow-xl overflow-hidden bg-slate-800">
              {searchResults.map(r => (
                <button key={r.symbol} onClick={() => handleSelectSymbol(r.symbol)}
                  className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-slate-700 active:bg-slate-600 transition-colors touch-manipulation">
                  <span className="font-bold text-blue-400 text-sm">{r.symbol}</span>
                  <span className="text-xs text-slate-400 truncate ml-3 max-w-[140px] sm:max-w-[180px]">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 shrink-0 touch-manipulation">
          <Search className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Search</span>
        </Button>
        <Button variant="outline" onClick={handleReset} size="sm"
          className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white shrink-0 touch-manipulation">
          <RefreshCw className="w-3.5 h-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>

      {/* ── Stock Header ─────────────────────────────────────────────────── */}
      {loadingQuote && !quote ? (
        <StockHeaderSkeleton />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-700/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-blue-400 font-bold text-base sm:text-lg">{symbol[0]}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white">{symbol}</h1>
                  {loadingQuote && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    wsLive ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-500"
                  }`}>
                    {wsLive ? <><Wifi className="w-3 h-3" /> LIVE</> : <><WifiOff className="w-3 h-3" /> Offline</>}
                  </span>
                </div>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5 truncate max-w-[200px] sm:max-w-none">
                  {loadingQuote ? "Loading…" : (quote?.name || symbol)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl sm:text-4xl font-bold text-white tabular-nums">
                ${currentPrice > 0 ? currentPrice.toFixed(2) : "—"}
                {livePrice && (
                  <span className="text-xs ml-1 sm:ml-2 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                    LIVE
                  </span>
                )}
              </p>
              {quote?.change != null && (
                <div className={`flex items-center gap-1 justify-end mt-1 text-xs sm:text-sm font-semibold ${
                  isPositive ? "text-emerald-400" : "text-red-400"
                }`}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {isPositive ? "+" : ""}{priceChange.toFixed(2)}{" "}
                  ({isPositive ? "+" : ""}{priceChangePct.toFixed(2)}%)
                  <span className="text-slate-500 font-normal ml-1 text-xs">today</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">

        {/* LEFT ──────────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-3 sm:space-y-4">

          {/* Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    Price Chart
                    {wsLive && livePrice && (
                      <span className="text-xs text-emerald-400 font-normal flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> ${livePrice.toFixed(2)}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                    {symbol} · {interval} · {wsLive ? "WebSocket live" : "REST data"}
                  </p>
                </div>
                {/* Chart style toggle — top right */}
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 shrink-0">
                  <button onClick={() => setChartStyle("line")}
                    className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-md text-xs font-semibold transition-all touch-manipulation ${
                      chartStyle === "line" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                    }`}>
                    <LineIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Line</span>
                  </button>
                  <button onClick={() => setChartStyle("candle")}
                    className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-md text-xs font-semibold transition-all touch-manipulation ${
                      chartStyle === "candle" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                    }`}>
                    <CandleIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Candle</span>
                  </button>
                </div>
              </div>

              {/* Interval buttons — scrollable on mobile */}
              <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-xs text-slate-500 mr-1 shrink-0">Period:</span>
                {Object.entries(INTERVAL_LABELS).map(([key, lbl]) => (
                  <button key={key} onClick={() => setInterval(key)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 touch-manipulation ${
                      interval === key ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <ChartContainer symbol={symbol} interval={interval} chartStyle={chartStyle} livePrice={livePrice} />

            <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-slate-800 bg-slate-900/50">
              {chartStyle === "line" ? (
                <p className="text-xs text-slate-500 flex gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-emerald-400 inline-block rounded" /> Uptrend
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-red-400 inline-block rounded" /> Downtrend
                  </span>
                  {wsLive && <span className="text-emerald-400">Live every 15s</span>}
                </p>
              ) : (
                <p className="text-xs text-slate-500 flex gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-emerald-400/80 inline-block" /> Bullish
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-red-400/80 inline-block" /> Bearish
                  </span>
                  {wsLive && <span className="text-emerald-400">Live</span>}
                </p>
              )}
            </div>
          </div>

          {/* Technical Indicators */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" /> Technical Indicators
              </h2>
              <button onClick={() => setShowIndicatorHelp(v => !v)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 touch-manipulation">
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{showIndicatorHelp ? "Hide guide" : "What are these?"}</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 hidden sm:block">Numbers that help predict if a stock might go up or down.</p>

            {showIndicatorHelp && (
              <div className="mb-4 bg-slate-800/60 rounded-xl p-4 border border-slate-700/30 space-y-2 text-xs text-slate-400 leading-relaxed">
                <p><strong className="text-slate-200">RSI</strong> — below 35 = possibly good to buy. Above 65 = might be overpriced.</p>
                <p><strong className="text-slate-200">MACD</strong> — positive = upward momentum. Negative = downward.</p>
                <p><strong className="text-slate-200">MA 20 / MA 50</strong> — price above average = bullish. Below = bearish.</p>
              </div>
            )}

            {loadingIndicators ? (
              <IndicatorsSkeleton />
            ) : indicators ? (
              <div className="space-y-4">
                <div className="bg-slate-800/60 rounded-xl p-3 sm:p-4 border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">RSI (14)</p>
                    <HelpTooltip text="Below 35 = oversold (possible buy). Above 65 = overbought (consider waiting)." />
                  </div>
                  <RsiGauge value={Number(indicators.rsi)} />
                </div>
                {/* Indicators: 1 col on mobile, 3 on sm+ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <IndicatorCard label="MACD"
                    value={(indicators.macd >= 0 ? "+" : "") + Number(indicators.macd).toFixed(2)}
                    signal={indicators.macd_signal}
                    tooltip="Positive = upward momentum (bullish). Negative = downward (bearish)."
                    what="Momentum" />
                  <IndicatorCard label="MA 20"
                    value={`$${Number(indicators.ma20).toFixed(2)}`}
                    signal={indicators.ma20_signal}
                    tooltip="20-day average. Price above = bullish. Price below = bearish."
                    what="Short-term trend" />
                  <IndicatorCard label="MA 50"
                    value={`$${Number(indicators.ma50).toFixed(2)}`}
                    signal={indicators.ma50_signal}
                    tooltip="50-day average. Longer-term trend indicator."
                    what="Long-term trend" />
                </div>
                <div className={`rounded-xl p-3 sm:p-4 border flex items-start gap-3 ${
                  overallSignal === "bullish" ? "bg-emerald-500/10 border-emerald-500/20"
                  : overallSignal === "bearish" ? "bg-red-500/10 border-red-500/20"
                  : "bg-yellow-500/10 border-yellow-500/20"
                }`}>
                  <div>
                    <p className={`text-sm font-semibold ${
                      overallSignal === "bullish" ? "text-emerald-400"
                      : overallSignal === "bearish" ? "text-red-400"
                      : "text-yellow-400"
                    }`}>
                      Overall: {overallSignal === "bullish" ? "Bullish" : overallSignal === "bearish" ? "Bearish" : "Mixed"} signals
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {overallSignal === "bullish"
                        ? `Most indicators suggest ${symbol} has positive momentum.`
                        : overallSignal === "bearish"
                        ? `Most indicators suggest ${symbol} is under selling pressure.`
                        : `Mixed signals for ${symbol}. Consider waiting for a clearer signal.`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5 italic">Indicators only — not financial advice.</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm py-4 text-center">No indicator data for {symbol}</p>
            )}
          </div>

          {/* Holdings */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-400" /> Your Holdings
                <span className="text-xs text-slate-500 font-normal hidden sm:inline">— stocks you currently own</span>
              </h2>
            </div>

            {loadingHoldings ? (
              <HoldingsSkeleton rows={3} />
            ) : holdingsWithPnl.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Wallet className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No holdings yet — place a trade to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30">
                      {["Stock", "Shares", "Bought at", "Price now", "P&L"].map((h, i) => (
                        <th key={h} className={`py-3 px-3 sm:px-4 text-xs font-semibold text-slate-400 uppercase ${
                          i > 0 ? "text-right" : "text-left"
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsWithPnl.map(h => (
                      <tr key={h.symbol}
                        className="border-b border-slate-800/60 hover:bg-slate-800/40 active:bg-slate-800/60 cursor-pointer transition-colors"
                        onClick={() => { setSymbol(h.symbol); setSearchInput(h.symbol); }}
                        title="Click to view this stock"
                      >
                        <td className="py-3 px-3 sm:px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                              <span className="text-blue-400 text-xs font-bold">{h.symbol[0]}</span>
                            </div>
                            <span className="font-semibold text-white text-xs sm:text-sm">{h.symbol}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-right text-slate-300 text-xs sm:text-sm">{h.shares}</td>
                        <td className="py-3 px-3 sm:px-4 text-right text-slate-300 text-xs sm:text-sm">${Number(h.purchase_price).toFixed(2)}</td>
                        <td className="py-3 px-3 sm:px-4 text-right text-slate-300 text-xs sm:text-sm">${Number(h.current_price).toFixed(2)}</td>
                        <td className={`py-3 px-3 sm:px-4 text-right font-semibold text-xs sm:text-sm ${h.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-600 px-4 py-2 italic hidden sm:block">Click any row to view that stock</p>
              </div>
            )}
          </div>

          {/* Trade History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <button onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-4 text-left hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors touch-manipulation">
              <History className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-white">Trade History</span>
              {loadingTrades && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
              {trades.length > 0 && (
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                  {trades.length}
                </span>
              )}
              <span className="ml-auto text-slate-500">
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>
            {showHistory && (
              trades.length === 0 ? (
                <div className="py-10 text-center border-t border-slate-800">
                  <History className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No trades yet!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-slate-800">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/30">
                        {["Date & Time", "Stock", "Action", "Shares", "Price", "Total"].map((h, i) => (
                          <th key={h} className={`py-3 px-3 sm:px-4 text-xs font-semibold text-slate-400 uppercase ${
                            i > 2 ? "text-right" : "text-left"
                          }`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map(t => (
                        <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-3 sm:px-4 text-slate-400 text-xs whitespace-nowrap">
                            {t.timestamp ? new Date(t.timestamp).toLocaleString() : "—"}
                          </td>
                          <td className="py-3 px-3 sm:px-4 font-semibold text-white text-sm">{t.symbol}</td>
                          <td className="py-3 px-3 sm:px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              t.trade_type === "BUY"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                            }`}>
                              {t.trade_type}
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right text-slate-300 text-sm">{t.shares}</td>
                          <td className="py-3 px-3 sm:px-4 text-right text-slate-300 text-sm">${Number(t.price).toFixed(2)}</td>
                          <td className="py-3 px-3 sm:px-4 text-right font-semibold text-white text-sm">${Number(t.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

        {/* RIGHT sidebar — hidden on mobile (shown as bottom sheet instead) ── */}
        <div className="hidden xl:block space-y-4">
          <PaperTradingInfo />

          {/* Account */}
          {loadingSummary ? (
            <AccountSkeleton />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Paper Account
              </h2>
              {summary ? (
                <div className="space-y-3">
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Total Account Value</p>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      ${summary.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs mt-1 font-semibold ${summary.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {summary.total_pnl >= 0 ? "+" : "-"}${Math.abs(summary.total_pnl).toFixed(2)} unrealised P&L
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                      <div>
                        <p className="text-slate-300 font-medium">Cash</p>
                        <p className="text-xs text-slate-500">Available to trade</p>
                      </div>
                      <span className="font-semibold text-emerald-400">
                        ${summary.paper_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                      <div>
                        <p className="text-slate-300 font-medium">Holdings</p>
                        <p className="text-xs text-slate-500">Current stocks value</p>
                      </div>
                      <span className="font-semibold text-white">
                        ${summary.holdings_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500 text-xs">Total trades</span>
                      <span className="text-sm font-semibold text-white">
                        {summary.total_trades}
                        <span className="text-xs text-slate-500 ml-1">
                          (<span className="text-emerald-400">{summary.buy_trades}B</span>
                          {" / "}
                          <span className="text-red-400">{summary.sell_trades}S</span>)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No balance data</p>
              )}
            </div>
          )}

          {/* Order Form */}
          {loadingSummary ? (
            <OrderFormSkeleton />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-400" /> Place an Order
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Trading: <strong className="text-blue-400">{symbol}</strong>
                {currentPrice > 0 && (
                  <> @ <strong className="text-white">${currentPrice.toFixed(2)}</strong>
                    {livePrice && <span className="text-emerald-400 ml-1 text-xs font-semibold">LIVE</span>}
                  </>
                )}
              </p>
              <OrderFormContent />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: Account summary strip (sm and below, below xl) ──────── */}
      <div className="xl:hidden bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" /> Paper Account
        </h2>
        {loadingSummary ? (
          <div className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
        ) : summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/30">
              <p className="text-xs text-slate-400">Total Value</p>
              <p className="text-base font-bold text-white tabular-nums mt-0.5">
                ${summary.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/30">
              <p className="text-xs text-slate-400">Cash</p>
              <p className="text-base font-bold text-emerald-400 tabular-nums mt-0.5">
                ${summary.paper_balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/30">
              <p className="text-xs text-slate-400">Holdings</p>
              <p className="text-base font-bold text-white tabular-nums mt-0.5">
                ${summary.holdings_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/30">
              <p className="text-xs text-slate-400">P&L</p>
              <p className={`text-base font-bold tabular-nums mt-0.5 ${summary.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {summary.total_pnl >= 0 ? "+" : ""}${summary.total_pnl.toFixed(0)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No balance data</p>
        )}
      </div>

      {/* ── Mobile: Sticky Trade Button ─────────────────────────────────── */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pointer-events-none">
        <button
          onClick={() => setShowOrderSheet(true)}
          className="pointer-events-auto w-full py-4 rounded-2xl font-bold text-base bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center gap-2 shadow-xl shadow-blue-900/40 touch-manipulation transition-all"
        >
          <ShoppingCart className="w-5 h-5" />
          Trade {symbol}
          {currentPrice > 0 && (
            <span className="text-blue-200 font-normal text-sm ml-1">
              @ ${currentPrice.toFixed(2)}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile: Order Bottom Sheet ───────────────────────────────────── */}
      {showOrderSheet && (
        <>
          {/* Backdrop */}
          <div
            className="xl:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowOrderSheet(false)}
          />
          {/* Sheet */}
          <div className="xl:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
            {/* Drag handle */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-400" /> Place an Order
              </h2>
              <button
                onClick={() => setShowOrderSheet(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Trading: <strong className="text-blue-400">{symbol}</strong>
              {currentPrice > 0 && (
                <> @ <strong className="text-white">${currentPrice.toFixed(2)}</strong>
                  {livePrice && <span className="text-emerald-400 ml-1 font-semibold">LIVE</span>}
                </>
              )}
            </p>
            <OrderFormContent />
            <div className="h-4" />
          </div>
        </>
      )}
    </div>
  );
}