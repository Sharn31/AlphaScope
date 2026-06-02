import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Plus, Trash2, Star } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { authFetch, BASE_URL, searchStocksAPI } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

interface WatchlistItem { id: number; symbol: string; created_at?: string; user?: number; }
interface StockQuote { symbol: string; price: number; high: number; low: number; volume: number | null; company_info: { name: string; sector: string; market_cap: number; }; }
interface YahooQuote { symbol: string; period: string; price: number[]; volume?: number; volumn?: number; }
interface EnrichedStock { id: number; symbol: string; name: string; sector: string; price: number; high: number; low: number; volume: string; marketCap: string; trend: number[]; }
interface SearchResult { symbol: string; name: string; }

async function getWatchlist(): Promise<WatchlistItem[]> {
  const res = await authFetch(`${BASE_URL}/market/watchlist/`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function addToWatchlist(symbol: string): Promise<WatchlistItem> {
  const res = await authFetch(`${BASE_URL}/market/watchlist/`, { method: "POST", body: JSON.stringify({ symbol }) });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function removeFromWatchlist(id: number): Promise<void> {
  const res = await authFetch(`${BASE_URL}/market/watchlist/${id}/`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed");
}
async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try { const res = await authFetch(`${BASE_URL}/market/stocks/${symbol}/`); if (!res.ok) return null; return res.json(); }
  catch { return null; }
}
async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  try { const res = await authFetch(`${BASE_URL}/market/yahoo_stock/${symbol}/?period=1d`); if (!res.ok) return null; return res.json(); }
  catch { return null; }
}
function formatMarketCap(cap: number): string {
  if (!cap) return "N/A";
  if (cap >= 1e12) return `$${(cap/1e12).toFixed(2)}T`;
  if (cap >= 1e9)  return `$${(cap/1e9).toFixed(2)}B`;
  if (cap >= 1e6)  return `$${(cap/1e6).toFixed(2)}M`;
  return `$${cap}`;
}
function formatVolume(vol: number | null | undefined): string {
  if (vol == null || vol === 0) return "N/A";
  if (vol >= 1e6) return `${(vol/1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol/1e3).toFixed(1)}K`;
  return `${vol}`;
}
function enrichStock(item: WatchlistItem, quote: StockQuote | null, yahoo: YahooQuote | null): EnrichedStock {
  const price = quote?.price ?? 0, high = quote?.high ?? 0, low = quote?.low ?? 0;
  const rawVol = yahoo?.volume ?? yahoo?.volumn ?? quote?.volume ?? null;
  let trend: number[] = [];
  if (Array.isArray(yahoo?.price) && yahoo!.price.length > 1) {
    trend = yahoo!.price;
  } else {
    trend = Array.from({ length: 7 }, (_, i) => {
      const base = low + (high - low) * (i / 6);
      return parseFloat((base + (Math.random() - 0.5) * (high - low) * 0.1).toFixed(2));
    });
    trend[trend.length - 1] = price;
  }
  return { id: item.id, symbol: item.symbol, name: quote?.company_info?.name ?? item.symbol, sector: quote?.company_info?.sector ?? "N/A", price, high, low, volume: formatVolume(rawVol), marketCap: formatMarketCap(quote?.company_info?.market_cap ?? 0), trend };
}

function WatchlistCardSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 animate-pulse space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-slate-800" />
          <div className="space-y-1.5"><div className="w-16 h-5 bg-slate-800 rounded" /><div className="w-28 h-3 bg-slate-800 rounded" /><div className="w-20 h-3 bg-slate-800 rounded" /></div>
        </div>
        <div className="w-7 h-7 rounded bg-slate-800" />
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-2"><div className="w-20 sm:w-24 h-7 bg-slate-800 rounded" /><div className="flex gap-3"><div className="w-14 h-3 bg-slate-800 rounded" /><div className="w-14 h-3 bg-slate-800 rounded" /></div></div>
        <div className="w-24 sm:w-32 h-12 sm:h-16 bg-slate-800 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
        <div className="space-y-1.5"><div className="w-12 h-3 bg-slate-800 rounded" /><div className="w-16 h-4 bg-slate-800 rounded" /></div>
        <div className="space-y-1.5"><div className="w-16 h-3 bg-slate-800 rounded" /><div className="w-20 h-4 bg-slate-800 rounded" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2"><div className="h-8 bg-slate-800 rounded" /><div className="h-8 bg-slate-800 rounded" /></div>
    </div>
  );
}

export default function Watchlist() {
  usePageTitle("Watchlist");
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [watchlist,     setWatchlist]     = useState<EnrichedStock[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isDialogOpen,  setIsDialogOpen]  = useState(false);
  const [searchSymbol,  setSearchSymbol]  = useState("");
  const [isAdding,      setIsAdding]      = useState(false);
  const [symbolResults, setSymbolResults] = useState<SearchResult[]>([]);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchWatchlist(); }, []);

  const fetchWatchlist = async () => {
    try {
      const items = await getWatchlist();
      const enriched = await Promise.all(items.map(async (item) => {
        const [quote, yahoo] = await Promise.all([fetchStockQuote(item.symbol), fetchYahooQuote(item.symbol)]);
        return enrichStock(item, quote, yahoo);
      }));
      setWatchlist(enriched);
    } catch { toast.error("Failed to load watchlist"); }
    finally { setIsLoading(false); }
  };

  const handleSymbolInput = (value: string) => {
    setSearchSymbol(value); setSymbolResults([]);
    if (!value.trim()) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSymbolLoading(true);
      try { const r = await searchStocksAPI(value); setSymbolResults(Array.isArray(r) ? r.slice(0, 6) : []); }
      catch { setSymbolResults([]); }
      finally { setSymbolLoading(false); }
    }, 400);
  };

  const handleSelectSymbol = (symbol: string) => { setSearchSymbol(symbol); setSymbolResults([]); };

  const handleAddStock = async () => {
    const symbol = searchSymbol.trim().toUpperCase();
    if (!symbol) { toast.error("Enter a symbol"); return; }
    if (watchlist.some(s => s.symbol === symbol)) { toast.error(`${symbol} already in watchlist`); return; }
    setIsAdding(true);
    try {
      const item = await addToWatchlist(symbol);
      const [quote, yahoo] = await Promise.all([fetchStockQuote(symbol), fetchYahooQuote(symbol)]);
      setWatchlist(prev => [...prev, enrichStock(item, quote, yahoo)]);
      toast.success(`Added ${symbol}`);
      setSearchSymbol(""); setSymbolResults([]); setIsDialogOpen(false);
    } catch { toast.error("Failed to add stock"); }
    finally { setIsAdding(false); }
  };

  const handleRemoveStock = useCallback(async (id: number) => {
    try { await removeFromWatchlist(id); setWatchlist(prev => prev.filter(s => s.id !== id)); toast.success("Removed"); }
    catch { toast.error("Failed to remove"); }
  }, []);

  const dark = isDarkMode;
  const tp   = dark ? "text-white"      : "text-slate-900";
  const ts   = dark ? "text-slate-400"  : "text-slate-500";

  return (
    <div className="space-y-4 sm:space-y-6 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${tp}`}>Watchlist</h1>
          {!isLoading && watchlist.length > 0 && (
            <p className={`text-xs sm:text-sm mt-0.5 ${ts}`}>{watchlist.length} stock{watchlist.length !== 1 ? "s" : ""} tracked</p>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={open => { setIsDialogOpen(open); if (!open) { setSearchSymbol(""); setSymbolResults([]); } }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 flex-shrink-0">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Stock
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined} className={`w-[calc(100vw-2rem)] sm:max-w-md mx-auto ${dark ? "bg-slate-900 border-slate-800" : "bg-white"}`}>
            <DialogHeader><DialogTitle className={tp}>Add Stock to Watchlist</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="relative">
                <input
                  type="text" value={searchSymbol}
                  onChange={e => handleSymbolInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddStock()}
                  placeholder="Search e.g. AAPL, Tesla..." autoComplete="off"
                  className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500 ${dark ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-300 text-slate-900"}`}
                />
                {symbolLoading && <div className="absolute right-3 top-2.5"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}
                {symbolResults.length > 0 && (
                  <div className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg overflow-hidden ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                    {symbolResults.map(stock => (
                      <button key={stock.symbol} onClick={() => handleSelectSymbol(stock.symbol)}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${dark ? "hover:bg-slate-700 text-white" : "hover:bg-slate-50 text-slate-900"}`}>
                        <span className="font-semibold text-blue-400 text-sm">{stock.symbol}</span>
                        <span className={`text-xs truncate ml-3 max-w-[160px] ${dark ? "text-slate-400" : "text-slate-500"}`}>{stock.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleAddStock} disabled={isAdding} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {isAdding ? "Adding…" : "Add to Watchlist"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {[1,2,3,4].map(i => <WatchlistCardSkeleton key={i} />)}
        </div>
      ) : watchlist.length === 0 ? (
        <Card className={dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}>
          <CardContent className="py-12 sm:py-16 text-center">
            <Star className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 mx-auto mb-4" />
            <p className={`text-sm sm:text-base ${ts}`}>Your watchlist is empty. Add stocks to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {watchlist.map(stock => (
            <Card key={stock.id} className={`transition-all ${dark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"}`}>

              <CardHeader className="px-4 sm:px-5 pt-4 pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <CardTitle className={`text-base sm:text-lg ${tp}`}>{stock.symbol}</CardTitle>
                      <p className={`text-xs mt-0.5 truncate ${ts}`}>{stock.name}</p>
                      <p className={`text-xs truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>{stock.sector}</p>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveStock(stock.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="px-4 sm:px-5 pt-3 pb-4 sm:pb-5 space-y-3">

                {/* Price + chart */}
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${tp}`}>${(stock.price ?? 0).toFixed(2)}</p>
                    <div className="flex gap-2 sm:gap-3 mt-1">
                      <span className="text-xs text-emerald-400">H: ${(stock.high ?? 0).toFixed(2)}</span>
                      <span className="text-xs text-red-400">L: ${(stock.low ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="w-24 sm:w-32 h-12 sm:h-16 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stock.trend.map((value, idx) => ({ value, idx }))}>
                        <Line type="monotone" dataKey="value"
                          stroke={stock.price >= (stock.trend[0] ?? 0) ? "#10b981" : "#ef4444"}
                          strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Stats */}
                <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${dark ? "border-slate-800" : "border-slate-100"}`}>
                  <div>
                    <p className={`text-xs ${ts}`}>Volume</p>
                    <p className={`text-sm font-semibold mt-0.5 ${tp}`}>{stock.volume}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${ts}`}>Market Cap</p>
                    <p className={`text-sm font-semibold mt-0.5 ${tp}`}>{stock.marketCap}</p>
                  </div>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => handleBuy(stock.symbol)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 sm:h-9 text-xs sm:text-sm" size="sm">
                    Buy
                  </Button>
                  <Button onClick={() => handleViewDetails(stock.symbol)}
                    className={`h-8 sm:h-9 text-xs sm:text-sm ${dark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"}`}
                    size="sm">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  function handleBuy(symbol: string) { navigate(`/trading?symbol=${symbol}&action=buy`); }
  function handleViewDetails(symbol: string) { navigate(`/trading?symbol=${symbol}`); }
}