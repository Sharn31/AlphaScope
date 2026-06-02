import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import {
  Plus, Trash2, TrendingUp, TrendingDown,
  Loader2, Wifi, DollarSign, BarChart2,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import {
  getPortfolio, addHolding, deleteHolding,
  searchStocksAPI, authFetch, BASE_URL,
} from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";
import { HoldingsSkeleton } from "../components/skeletons/Skeletons";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RawHolding {
  id: number; symbol: string; name?: string;
  shares?: number; quantity?: number;
  purchase_price?: number; buy_price?: number;
  current_price?: number; created_at: string;
}
interface EnrichedHolding {
  id: number; symbol: string; name: string;
  quantity: number; buy_price: number;
  current_price: number; current_value: number;
  pnl: number; pnl_percent: number; created_at: string;
}
interface SearchResult { symbol: string; name: string; }
interface StockQuote {
  price: number; high?: number; low?: number;
  company_info?: { name?: string; sector?: string; market_cap?: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchExactQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const res = await authFetch(`${BASE_URL}/market/stocks/${symbol}/`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function enrichHolding(h: RawHolding): Promise<EnrichedHolding> {
  const buy_price = Number(h.buy_price ?? h.purchase_price ?? 0);
  const quantity  = Number(h.quantity  ?? h.shares ?? 0);
  try {
    const q             = await fetchExactQuote(h.symbol);
    const current_price = q?.price ? Number(q.price) : buy_price;
    const name          = h.name ?? q?.company_info?.name ?? h.symbol;
    return {
      id: h.id, symbol: h.symbol, name, quantity, buy_price, current_price,
      current_value: current_price * quantity,
      pnl:           (current_price - buy_price) * quantity,
      pnl_percent:   buy_price > 0 ? ((current_price - buy_price) / buy_price) * 100 : 0,
      created_at: h.created_at,
    };
  } catch {
    return {
      id: h.id, symbol: h.symbol, name: h.name ?? h.symbol,
      quantity, buy_price, current_price: buy_price,
      current_value: buy_price * quantity, pnl: 0, pnl_percent: 0,
      created_at: h.created_at,
    };
  }
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Skeletons ────────────────────────────────────────────────────────────────
function SummaryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="w-24 h-3 bg-slate-800 rounded" />
        <div className="w-8 h-8 bg-slate-800 rounded-xl" />
      </div>
      <div className="w-32 h-8 bg-slate-800 rounded" />
      <div className="w-20 h-3 bg-slate-800 rounded" />
    </div>
  );
}

// ─── Symbol Avatar ────────────────────────────────────────────────────────────
function SymbolAvatar({ symbol }: { symbol: string }) {
  const colors = [
    "from-blue-500 to-blue-700", "from-violet-500 to-violet-700",
    "from-emerald-500 to-emerald-700", "from-orange-500 to-orange-700",
    "from-pink-500 to-pink-700", "from-cyan-500 to-cyan-700",
  ];
  const idx = symbol.charCodeAt(0) % colors.length;
  return (
    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center flex-shrink-0 shadow-md`}>
      <span className="text-white text-xs font-bold">{symbol.slice(0, 2)}</span>
    </div>
  );
}

// ─── Mobile Holding Card ──────────────────────────────────────────────────────
function MobileHoldingCard({ h, dark, onRemove }: {
  h: EnrichedHolding; dark: boolean; onRemove: (id: number) => void;
}) {
  const isUp     = h.pnl >= 0;
  const pnlColor = isUp ? "text-emerald-400" : "text-red-400";
  const pnlBg    = isUp
    ? "bg-emerald-500/8 border-emerald-500/20"
    : "bg-red-500/8 border-red-500/20";

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      dark
        ? "bg-slate-800/50 border-slate-700/60 hover:border-slate-600"
        : "bg-slate-50 border-slate-200 hover:border-slate-300"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <SymbolAvatar symbol={h.symbol} />
          <div className="min-w-0">
            <p className={`font-bold text-sm ${dark ? "text-white" : "text-slate-900"}`}>{h.symbol}</p>
            <p className={`text-xs truncate ${dark ? "text-slate-400" : "text-slate-500"}`}>{h.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(h.pnl_percent).toFixed(2)}%
          </span>
          <button onClick={() => onRemove(h.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-2.5 p-3 rounded-xl ${dark ? "bg-slate-900/60" : "bg-white"}`}>
        {[
          { label: "Shares",        value: String(h.quantity) },
          { label: "Avg Cost",      value: `$${h.buy_price.toFixed(2)}` },
          { label: "Current Price", value: `$${h.current_price.toFixed(2)}` },
          { label: "Market Value",  value: `$${fmt(h.current_value)}` },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
            <p className={`text-sm font-semibold mt-0.5 tabular-nums ${dark ? "text-slate-200" : "text-slate-800"}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className={`mt-2.5 flex items-center justify-between px-3 py-2 rounded-xl border ${pnlBg}`}>
        <span className={`text-xs font-medium ${pnlColor}`}>Unrealised P&L</span>
        <span className={`text-sm font-bold tabular-nums ${pnlColor}`}>
          {isUp ? "+" : ""}${fmt(h.pnl)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Portfolio() {
  usePageTitle("Portfolio");
  const { isDarkMode: dark } = useTheme();

  const [holdings,     setHoldings]     = useState<EnrichedHolding[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortField,    setSortField]    = useState<keyof EnrichedHolding>("current_value");
  const [sortAsc,      setSortAsc]      = useState(false);

  const [searchInput,    setSearchInput]    = useState("");
  const [searchResults,  setSearchResults]  = useState<SearchResult[]>([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedName,   setSelectedName]   = useState("");
  const [quotedPrice,    setQuotedPrice]    = useState<number | null>(null);
  const [quoteLoading,   setQuoteLoading]   = useState(false);
  const [quantity,       setQuantity]       = useState("");
  const [buyPrice,       setBuyPrice]       = useState("");
  const [isAdding,       setIsAdding]       = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef          = useRef<WebSocket | null>(null);
  const [wsLive,        setWsLive]          = useState(false);

  const connectWebSocket = useCallback((symbols: string[]) => {
    if (!symbols.length) return;
    wsRef.current?.close();
    const ws = new WebSocket(`${import.meta.env?.VITE_WS_URL ?? "ws://localhost:8000"}/ws/prices/?symbols=${symbols.join(",")}`);
    ws.onopen    = () => setWsLive(true);
    ws.onclose   = () => setWsLive(false);
    ws.onerror   = () => {};
    ws.onmessage = (e) => {
      try {
        const { symbol: sym, price } = JSON.parse(e.data) as { symbol: string; price: number };
        setHoldings(prev => prev.map(h => {
          if (h.symbol !== sym) return h;
          const cp  = Number(price);
          const cv  = cp * h.quantity;
          const pnl = (cp - h.buy_price) * h.quantity;
          return { ...h, current_price: cp, current_value: cv, pnl, pnl_percent: h.buy_price > 0 ? (pnl / (h.buy_price * h.quantity)) * 100 : 0 };
        }));
      } catch { /* ignore */ }
    };
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    const syms = holdings.map(h => h.symbol);
    if (syms.length) connectWebSocket(syms);
    return () => wsRef.current?.close();
  }, [holdings.map(h => h.symbol).join(",")]); // eslint-disable-line

  const fetchHoldings = async () => {
    try {
      const data = await getPortfolio();
      const enriched = await Promise.all((Array.isArray(data) ? data : []).map(enrichHolding));
      setHoldings(enriched);
    } catch { toast.error("Failed to load portfolio"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchHoldings(); }, []);

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    setSelectedSymbol(""); setSelectedName(""); setQuotedPrice(null); setSearchResults([]);
    if (!val.trim()) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try { setSearchResults((await searchStocksAPI(val.trim()) as SearchResult[]).slice(0, 6)); }
      catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
  };

  const handleSelectSymbol = async (symbol: string, name: string) => {
    setSearchInput(symbol); setSearchResults([]);
    setSelectedSymbol(symbol); setSelectedName(name);
    setQuoteLoading(true); setQuotedPrice(null);
    try {
      const q = await fetchExactQuote(symbol);
      const p = q?.price ? Number(q.price) : null;
      setQuotedPrice(p);
      if (p !== null) setBuyPrice(prev => prev === "" ? p.toFixed(2) : prev);
    } catch { setQuotedPrice(null); }
    finally { setQuoteLoading(false); }
  };

  const resetDialog = () => {
    setSearchInput(""); setSearchResults([]); setSelectedSymbol(""); setSelectedName("");
    setQuotedPrice(null); setQuoteLoading(false); setQuantity(""); setBuyPrice("");
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) resetDialog();
  };

  const handleAddHolding = async () => {
    if (!selectedSymbol)        { toast.error("Please select a symbol from the dropdown"); return; }
    if (!quantity || !buyPrice) { toast.error("Please fill quantity and buy price"); return; }
    const qty = parseFloat(quantity), bp = parseFloat(buyPrice);
    if (isNaN(qty) || isNaN(bp) || qty <= 0 || bp <= 0) { toast.error("Quantity and price must be positive"); return; }
    setIsAdding(true);
    try {
      const data = await addHolding({ symbol: selectedSymbol, quantity: qty, buy_price: bp, name: selectedName || selectedSymbol });
      // ✅ FIX: enrich BEFORE passing to setState — can't use await inside setState callback
      const enriched = await enrichHolding({ ...data, name: data.name ?? selectedName ?? selectedSymbol });
      setHoldings(prev => [...prev, enriched]);
      handleDialogChange(false);
      toast.success(`${selectedSymbol} added to portfolio`);
    } catch { toast.error("Failed to add holding"); }
    finally { setIsAdding(false); }
  };

  const handleRemoveHolding = async (id: number) => {
    try {
      await deleteHolding(id);
      setHoldings(prev => prev.filter(h => h.id !== id));
      toast.success("Holding removed");
    } catch { toast.error("Failed to remove"); }
  };

  const toggleSort = (field: keyof EnrichedHolding) => {
    if (sortField === field) setSortAsc(v => !v);
    else { setSortField(field); setSortAsc(false); }
  };

  const sortedHoldings = [...holdings].sort((a, b) => {
    const av = a[sortField] as number, bv = b[sortField] as number;
    return sortAsc ? av - bv : bv - av;
  });

  const totalValue  = holdings.reduce((s, h) => s + h.current_value, 0);
  const totalCost   = holdings.reduce((s, h) => s + h.buy_price * h.quantity, 0);
  const totalGain   = totalValue - totalCost;
  const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const card     = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const tp       = dark ? "text-white"      : "text-slate-900";
  const ts       = dark ? "text-slate-400"  : "text-slate-500";
  const tm       = dark ? "text-slate-300"  : "text-slate-600";
  const inputCls = dark
    ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
    : "bg-slate-50 border-slate-300 text-slate-900";

  const SortIcon = ({ field }: { field: keyof EnrichedHolding }) =>
    sortField === field
      ? sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
      : null;

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className={`text-xl sm:text-3xl font-bold ${tp}`}>Portfolio</h1>
          {wsLive && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <Wifi className="w-3 h-3" /> LIVE
            </span>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm flex-shrink-0">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Holding</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>

          <DialogContent aria-describedby={undefined}
            className={`w-[calc(100vw-2rem)] max-w-md ${dark ? "bg-slate-900 border-slate-800" : "bg-white"}`}>
            <DialogHeader>
              <DialogTitle className={tp}>Add Holding</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Symbol search */}
              <div>
                <Label className={dark ? "text-slate-300" : "text-slate-700"}>Symbol</Label>
                <div className="relative mt-1.5">
                  <input type="text" value={searchInput}
                    onChange={e => handleSearchInput(e.target.value)}
                    placeholder="Search e.g. AAPL, Tesla…" autoComplete="off"
                    className={`w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`} />
                  {searchLoading && (
                    <div className="absolute right-3 top-3">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className={`absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden ${
                      dark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                    }`}>
                      {searchResults.map(s => (
                        <button key={s.symbol} onClick={() => handleSelectSymbol(s.symbol, s.name)}
                          className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                            dark ? "hover:bg-slate-700 text-white" : "hover:bg-slate-50 text-slate-900"
                          }`}>
                          <span className="font-bold text-blue-400 text-sm flex-shrink-0">{s.symbol}</span>
                          <span className={`text-xs truncate ml-3 ${dark ? "text-slate-400" : "text-slate-500"}`}>{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {quoteLoading && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching price…
                  </div>
                )}
                {selectedSymbol && !quoteLoading && (
                  <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs font-semibold text-emerald-400">{selectedName || selectedSymbol}</p>
                    <p className={`text-xs mt-0.5 ${tm}`}>
                      Live price: <span className="font-semibold text-emerald-400">
                        {quotedPrice !== null ? `$${fmt(quotedPrice)}` : "N/A"}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Quantity + Buy Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={dark ? "text-slate-300" : "text-slate-700"}>Shares</Label>
                  <input type="number" placeholder="e.g. 10" value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm border mt-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`} />
                </div>
                <div>
                  <Label className={dark ? "text-slate-300" : "text-slate-700"}>
                    Buy Price
                    {quotedPrice !== null && <span className="ml-1 text-xs text-blue-400">auto</span>}
                  </Label>
                  <input type="number" placeholder="e.g. 150.00" value={buyPrice}
                    onChange={e => setBuyPrice(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm border mt-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`} />
                </div>
              </div>

              <Button onClick={handleAddHolding}
                disabled={isAdding || quoteLoading || !selectedSymbol}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-xl text-sm font-semibold">
                {isAdding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding…</> : "Add to Portfolio"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {isLoading ? [1,2,3].map(i => <SummaryCardSkeleton key={i} />) : [
          {
            label:  "Total Value",
            value:  `$${fmt(totalValue)}`,
            sub:    `${holdings.length} position${holdings.length !== 1 ? "s" : ""}`,
            color:  tp,
            icon:   <DollarSign className="w-4 h-4" />,
            iconBg: "bg-blue-500/15 text-blue-400",
          },
          {
            label:  "Total Gain / Loss",
            value:  `${totalGain >= 0 ? "+" : ""}$${fmt(totalGain)}`,
            sub:    "Since inception",
            color:  totalGain >= 0 ? "text-emerald-400" : "text-red-400",
            icon:   totalGain >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
            iconBg: totalGain >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
          },
          {
            label:  "Total Return",
            value:  `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`,
            sub:    `vs $${fmt(totalCost)} invested`,
            color:  totalReturn >= 0 ? "text-emerald-400" : "text-red-400",
            icon:   <BarChart2 className="w-4 h-4" />,
            iconBg: totalReturn >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
          },
        ].map(({ label, value, sub, color, icon, iconBg }) => (
          <div key={label} className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
            <div className="flex items-start justify-between mb-3">
              <p className={`text-xs sm:text-sm font-medium ${ts}`}>{label}</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                {icon}
              </div>
            </div>
            <p className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className={`text-xs mt-1 ${ts}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Holdings ─────────────────────────────────────────────────────── */}
      <Card className={`${card} rounded-2xl`}>
        <CardHeader className="px-4 sm:px-6 pt-5 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className={`text-base sm:text-lg font-semibold ${tp}`}>Holdings</CardTitle>
            {holdings.length > 0 && !isLoading && (
              <span className={`text-xs px-2 py-1 rounded-full ${dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                {holdings.length} position{holdings.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 sm:px-6 pb-5">
          {isLoading ? (
            <HoldingsSkeleton rows={4} />
          ) : holdings.length === 0 ? (
            <div className="py-16 text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                dark ? "bg-slate-800" : "bg-slate-100"
              }`}>
                <BarChart2 className={`w-7 h-7 ${ts}`} />
              </div>
              <p className={`font-semibold ${tp}`}>No holdings yet</p>
              <p className={`text-sm mt-1 mb-4 ${ts}`}>Add your first holding to start tracking</p>
              <Button onClick={() => setIsDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Add Holding
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile cards (below md) */}
              <div className="md:hidden space-y-3">
                {sortedHoldings.map(h => (
                  <MobileHoldingCard key={h.id} h={h} dark={dark} onRemove={handleRemoveHolding} />
                ))}
              </div>

              {/* Desktop table (md and above) */}
              <div className="hidden md:block overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${dark ? "border-slate-800" : "border-slate-100"}`}>
                      {[
                        { label: "Symbol",       field: "symbol"        as keyof EnrichedHolding },
                        { label: "Shares",        field: "quantity"      as keyof EnrichedHolding },
                        { label: "Avg Cost",      field: "buy_price"     as keyof EnrichedHolding },
                        { label: "Current Price", field: "current_price" as keyof EnrichedHolding },
                        { label: "Market Value",  field: "current_value" as keyof EnrichedHolding },
                        { label: "P&L",           field: "pnl"           as keyof EnrichedHolding },
                        { label: "Return",        field: "pnl_percent"   as keyof EnrichedHolding },
                      ].map(({ label, field }) => (
                        <th key={field}
                          onClick={() => toggleSort(field)}
                          className={`pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:opacity-80 transition-opacity ${ts}`}>
                          {label}<SortIcon field={field} />
                        </th>
                      ))}
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-transparent">
                    {sortedHoldings.map(h => (
                      <tr key={h.id}
                        className={`transition-colors ${dark ? "hover:bg-slate-800/50" : "hover:bg-slate-50"}`}>
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <SymbolAvatar symbol={h.symbol} />
                            <div>
                              <p className={`font-bold text-sm ${tp}`}>{h.symbol}</p>
                              <p className={`text-xs truncate max-w-[120px] ${ts}`}>{h.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`py-3.5 pr-4 tabular-nums ${tm}`}>{h.quantity}</td>
                        <td className={`py-3.5 pr-4 tabular-nums ${tm}`}>${h.buy_price.toFixed(2)}</td>
                        <td className={`py-3.5 pr-4 tabular-nums font-medium ${tp}`}>${h.current_price.toFixed(2)}</td>
                        <td className={`py-3.5 pr-4 tabular-nums font-semibold ${tp}`}>${fmt(h.current_value)}</td>
                        <td className={`py-3.5 pr-4 tabular-nums font-semibold ${h.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {h.pnl >= 0 ? "+" : ""}${fmt(h.pnl)}
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            h.pnl_percent >= 0
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-red-500/15 text-red-400"
                          }`}>
                            {h.pnl_percent >= 0 ? "+" : ""}{h.pnl_percent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3.5">
                          <button onClick={() => handleRemoveHolding(h.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}