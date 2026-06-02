/**
 * News.tsx — AlphaScope News Page (COMPLETE FIXED)
 * Save to: src/app/pages/News.tsx
 *
 * Fixes:
 *  1. handleToggleRow — toggle OFF creates alert then PATCHes to paused
 *  2. handleToggleRow — toggle ON/OFF with existing alertId sends explicit is_active
 *  3. AlertRowItem shows correct active/paused state
 *  4. Digest toggle persists in localStorage
 */

import { useState, useEffect, useCallback } from "react";
import {
  Newspaper, RefreshCw, Mail, MailCheck,
  ExternalLink, Clock, TrendingUp, TrendingDown, Minus,
  Filter, Search, AlertCircle, Loader2, Plus, X, Bell, Send,
  Briefcase, Star, BellOff,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { authFetch, BASE_URL } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NewsItem {
  id?:           number;
  symbol:        string;
  headline:      string;
  url:           string;
  source?:       string;
  datetime?:     number;
  published_at?: string;
}

interface NewsAlert {
  id:         number;
  symbol:     string;
  keyword:    string;
  is_active:  boolean;
  created_at: string;
}

interface AlertRow {
  symbol:  string;
  alertId: number | null;
  isActive: boolean;
  keyword:  string;
  sources:  SymbolSource[];
}

type SymbolSource = "watchlist" | "portfolio" | "custom";
type Sentiment    = "positive" | "negative" | "neutral";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectSentiment(headline: string): Sentiment {
  const h   = headline.toLowerCase();
  const pos = ["surge","soar","rise","gain","rally","beat","record","high","profit",
                "growth","up","bull","strong","boost","jump","wins","upgrade","outperform"];
  const neg = ["fall","drop","decline","loss","miss","cut","low","bear","crash","tumble",
                "down","warn","risk","debt","slump","layoff","downgrade","underperform","plunge"];
  if (pos.some(w => h.includes(w))) return "positive";
  if (neg.some(w => h.includes(w))) return "negative";
  return "neutral";
}

function timeAgo(item: NewsItem): string {
  let s: number | null = null;
  if (item.datetime && item.datetime > 0) s = item.datetime;
  else if (item.published_at) {
    const ms = new Date(item.published_at).getTime();
    if (!isNaN(ms)) s = Math.floor(ms / 1000);
  }
  if (!s) return "";
  const d = Math.floor((Date.now() / 1000 - s) / 60);
  if (d < 1)    return "just now";
  if (d < 60)   return `${d}m ago`;
  if (d < 1440) return `${Math.floor(d / 60)}h ago`;
  return `${Math.floor(d / 1440)}d ago`;
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
}

// ─── Sentiment Badge ──────────────────────────────────────────────────────────
function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const map = {
    positive: { icon: TrendingUp,   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", label: "Bullish" },
    negative: { icon: TrendingDown, cls: "bg-red-500/15    text-red-400    border-red-500/25",       label: "Bearish" },
    neutral:  { icon: Minus,        cls: "bg-slate-500/15  text-slate-400  border-slate-500/25",     label: "Neutral" },
  }[sentiment];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${map.cls}`}>
      <Icon className="w-3 h-3" /> {map.label}
    </span>
  );
}

// ─── News Card ────────────────────────────────────────────────────────────────
function NewsCard({ item, isDarkMode }: { item: NewsItem; isDarkMode: boolean }) {
  const sentiment = detectSentiment(item.headline);
  const ago       = timeAgo(item);
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className={`group flex flex-col gap-2.5 p-4 rounded-xl border transition-all hover:scale-[1.01] ${
        isDarkMode
          ? "bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
            {item.symbol}
          </span>
          <SentimentBadge sentiment={sentiment} />
          {item.source && (
            <span className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              {item.source}
            </span>
          )}
        </div>
        <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" />
      </div>
      <p className={`text-sm font-medium leading-snug line-clamp-3 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {item.headline}
      </p>
      {ago && (
        <div className={`flex items-center gap-1 text-xs ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>
          <Clock className="w-3 h-3" /> {ago}
        </div>
      )}
    </a>
  );
}

// ─── Source Tag Pills ─────────────────────────────────────────────────────────
function SourceTags({ sources, isDarkMode }: { sources: SymbolSource[]; isDarkMode: boolean }) {
  const meta: Record<SymbolSource, { label: string; icon: typeof Star; cls: string }> = {
    watchlist: { label: "Watchlist", icon: Star,      cls: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
    portfolio: { label: "Portfolio", icon: Briefcase, cls: "bg-amber-500/15  text-amber-400  border-amber-500/20"  },
    custom:    { label: "Custom",    icon: Bell,       cls: "bg-blue-500/15   text-blue-400   border-blue-500/20"   },
  };
  return (
    <div className="flex gap-1 flex-wrap">
      {sources.map(s => {
        const { label, icon: Icon, cls } = meta[s];
        return (
          <span key={s} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${cls}`}>
            <Icon className="w-2.5 h-2.5" /> {label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function AlertToggle({ isActive, onToggle, disabled }: {
  isActive: boolean; onToggle: () => void; disabled: boolean;
}) {
  return (
    <button onClick={onToggle} disabled={disabled}
      title={isActive ? "Pause alert emails" : "Enable alert emails"}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none disabled:opacity-40 ${
        isActive ? "bg-blue-500 border-blue-400" : "bg-slate-600 border-slate-500"
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
        isActive ? "translate-x-4" : "translate-x-0.5"
      }`} />
    </button>
  );
}

// ─── Alert Row Item ───────────────────────────────────────────────────────────
function AlertRowItem({ row, isDarkMode, toggling, onToggle, onDelete }: {
  row: AlertRow; isDarkMode: boolean; toggling: boolean;
  onToggle: (row: AlertRow) => void;
  onDelete: (row: AlertRow) => void;
}) {
  const isCustomOnly = row.sources.length === 1 && row.sources[0] === "custom";
  const textP = isDarkMode ? "text-white" : "text-slate-900";
  const textS = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
      row.isActive
        ? isDarkMode ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200"
        : isDarkMode ? "bg-slate-800   border-slate-700 opacity-60" : "bg-slate-100 border-slate-200 opacity-60"
    }`}>

      {/* Left */}
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <span className={`text-xs font-bold flex-shrink-0 ${row.isActive ? "text-blue-300" : textS}`}>
          {row.symbol}
        </span>
        <SourceTags sources={row.sources} isDarkMode={isDarkMode} />
        {row.keyword && (
          <span className={`text-xs truncate ${textS}`}>· {row.keyword}</span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          row.isActive
            ? "bg-emerald-500/15 text-emerald-400"
            : isDarkMode ? "bg-slate-700 text-slate-500" : "bg-slate-200 text-slate-400"
        }`}>
          {row.isActive ? "Active" : "Paused"}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <AlertToggle isActive={row.isActive} onToggle={() => onToggle(row)} disabled={toggling} />
        {isCustomOnly && (
          <button onClick={() => onDelete(row)}
            className={`opacity-40 hover:opacity-100 transition-opacity ${
              isDarkMode ? "text-slate-400 hover:text-red-400" : "text-slate-400 hover:text-red-500"
            }`}
            title={`Remove ${row.symbol} alert`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function News() {
  usePageTitle("News");
  const { isDarkMode } = useTheme();

  const [news,           setNews]           = useState<NewsItem[]>([]);
  const [symbols,        setSymbols]        = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("ALL");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [isLoading,      setIsLoading]      = useState(true);
  const [isRefreshing,   setIsRefreshing]   = useState(false);
  const [newsAlerts,     setNewsAlerts]     = useState<NewsAlert[]>([]);
  const [watchlistSyms,  setWatchlistSyms]  = useState<string[]>([]);
  const [portfolioSyms,  setPortfolioSyms]  = useState<string[]>([]);
  const [showAlertForm,  setShowAlertForm]  = useState(false);
  const [alertSymbol,    setAlertSymbol]    = useState("");
  const [alertKeyword,   setAlertKeyword]   = useState("");
  const [creatingAlert,  setCreatingAlert]  = useState(false);
  const [sendingDigest,  setSendingDigest]  = useState(false);
  const [togglingSyms,   setTogglingSyms]   = useState<Set<string>>(new Set());

  const [emailDigest, setEmailDigest] = useState<boolean>(() => {
    try { return localStorage.getItem("alphascope_digest") === "true"; } catch { return false; }
  });
  const [digestLoading, setDigestLoading] = useState(false);

  const cardBg   = isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const inputCls = isDarkMode
    ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
    : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400";
  const textP = isDarkMode ? "text-white"     : "text-slate-900";
  const textS = isDarkMode ? "text-slate-400" : "text-slate-500";

  // ── Fetch news ──────────────────────────────────────────────────────────────
  const fetchNews = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else         setIsRefreshing(true);
    try {
      const [liveRes, dbRes] = await Promise.allSettled([
        authFetch(`${BASE_URL}/market/news/market/`),
        authFetch(`${BASE_URL}/market/news/`),
      ]);
      const all: NewsItem[] = [];
      if (liveRes.status === "fulfilled" && liveRes.value.ok) {
        const d = await liveRes.value.json();
        const live: NewsItem[] = Array.isArray(d) ? d : (d.news ?? []);
        all.push(...live.map(i => ({ ...i, source: i.source ?? "Finnhub" })));
      }
      if (dbRes.status === "fulfilled" && dbRes.value.ok) {
        const d = await dbRes.value.json();
        const db: NewsItem[] = Array.isArray(d) ? d : (d.news ?? []);
        all.push(...db);
      }
      const unique = dedupeNews(all).sort((a, b) => {
        const ta = a.datetime ?? (a.published_at ? new Date(a.published_at).getTime() / 1000 : 0);
        const tb = b.datetime ?? (b.published_at ? new Date(b.published_at).getTime() / 1000 : 0);
        return tb - ta;
      });
      setNews(unique);
      setSymbols([...new Set(unique.map(i => i.symbol))].sort());
    } catch { if (!silent) toast.error("Could not load news."); }
    finally   { setIsLoading(false); setIsRefreshing(false); }
  }, []);

  const fetchNewsAlerts = useCallback(async () => {
    try {
      const res = await authFetch(`${BASE_URL}/market/news/alerts/`);
      if (!res.ok) return;
      const d = await res.json();
      setNewsAlerts(Array.isArray(d) ? d : []);
    } catch { /* silent */ }
  }, []);

  const fetchWatchlistAndPortfolio = useCallback(async () => {
    try {
      const [wlRes, portRes] = await Promise.allSettled([
        authFetch(`${BASE_URL}/market/watchlist/`),
        authFetch(`${BASE_URL}/market/portfolio/`),
      ]);
      if (wlRes.status === "fulfilled" && wlRes.value.ok) {
        const d = await wlRes.value.json();
        const list: string[] = (Array.isArray(d) ? d : (d.results ?? d.watchlist ?? []))
          .map((item: any) => typeof item === "string" ? item : item.symbol)
          .filter(Boolean);
        setWatchlistSyms([...new Set(list)]);
      }
      if (portRes.status === "fulfilled" && portRes.value.ok) {
        const d = await portRes.value.json();
        const list: string[] = (Array.isArray(d) ? d : (d.results ?? d.holdings ?? []))
          .map((item: any) => typeof item === "string" ? item : item.symbol)
          .filter(Boolean);
        setPortfolioSyms([...new Set(list)]);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNews();
    fetchNewsAlerts();
    fetchWatchlistAndPortfolio();
    const t = setInterval(() => fetchNews(true), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchNews, fetchNewsAlerts, fetchWatchlistAndPortfolio]);

  // ─── Build unified alert rows ─────────────────────────────────────────────
  const alertRows: AlertRow[] = (() => {
    const alertMap = new Map<string, NewsAlert>();
    newsAlerts.forEach(a => alertMap.set(a.symbol, a));
    const wlSet   = new Set(watchlistSyms);
    const portSet = new Set(portfolioSyms);
    const allSyms = new Set([...watchlistSyms, ...portfolioSyms, ...newsAlerts.map(a => a.symbol)]);
    return [...allSyms].sort().map(sym => {
      const alert   = alertMap.get(sym);
      const sources: SymbolSource[] = [];
      if (wlSet.has(sym))   sources.push("watchlist");
      if (portSet.has(sym)) sources.push("portfolio");
      if (!wlSet.has(sym) && !portSet.has(sym)) sources.push("custom");
      return {
        symbol:   sym,
        alertId:  alert?.id  ?? null,
        isActive: alert ? alert.is_active : true,  // default active if no record
        keyword:  alert?.keyword ?? "",
        sources,
      };
    });
  })();

  // ─── FIXED: Toggle row ON/OFF ─────────────────────────────────────────────
  const handleToggleRow = async (row: AlertRow) => {
    const newValue = !row.isActive;
    const sym      = row.symbol;

    setTogglingSyms(prev => new Set(prev).add(sym));

    try {
      if (row.alertId === null) {
        // No alert record exists yet
        if (!newValue) {
          // Toggling OFF — must CREATE record first, then PATCH to paused
          const createRes = await authFetch(`${BASE_URL}/market/news/alerts/`, {
            method: "POST",
            body:   JSON.stringify({ symbol: sym, keyword: "" }),
          });
          const created = await createRes.json();

          if (!createRes.ok) {
            if (created.error?.includes("already exists")) {
              // Race condition — reload alerts and ask user to retry
              await fetchNewsAlerts();
              toast.info("Please try toggling again.");
            } else {
              toast.error(created.error ?? "Could not pause alert");
            }
            return;
          }

          // Now PATCH to paused with explicit is_active: false
          const patchRes = await authFetch(
            `${BASE_URL}/market/news/alerts/${created.id}/`,
            { method: "PATCH", body: JSON.stringify({ is_active: false }) }
          );
          const patched = await patchRes.json();

          if (patchRes.ok) {
            setNewsAlerts(prev => [{ ...created, is_active: false }, ...prev]);
            toast.success(`News alerts paused for ${sym}`);
          } else {
            toast.error(patched.error ?? "Could not pause alert");
          }
        } else {
          // Toggling ON with no record — already active by default
          toast.success(`${sym} is already included in your news digest`);
        }
      } else {
        // Alert record EXISTS — optimistic update then PATCH with explicit value
        setNewsAlerts(prev =>
          prev.map(a => a.id === row.alertId ? { ...a, is_active: newValue } : a)
        );

        const res  = await authFetch(
          `${BASE_URL}/market/news/alerts/${row.alertId}/`,
          { method: "PATCH", body: JSON.stringify({ is_active: newValue }) }
        );
        const data = await res.json();

        if (!res.ok) {
          // Rollback
          setNewsAlerts(prev =>
            prev.map(a => a.id === row.alertId ? { ...a, is_active: !newValue } : a)
          );
          toast.error(data.error ?? "Could not update alert");
        } else {
          toast.success(newValue ? `Alerts enabled for ${sym}` : `Alerts paused for ${sym}`);
        }
      }
    } catch {
      toast.error("Network error");
      if (row.alertId !== null) {
        setNewsAlerts(prev =>
          prev.map(a => a.id === row.alertId ? { ...a, is_active: !newValue } : a)
        );
      }
    } finally {
      setTogglingSyms(prev => { const n = new Set(prev); n.delete(sym); return n; });
    }
  };

  // ─── Delete custom alert ──────────────────────────────────────────────────
  const handleDeleteRow = async (row: AlertRow) => {
    if (!row.alertId) return;
    setNewsAlerts(prev => prev.filter(a => a.id !== row.alertId));
    try {
      const res = await authFetch(`${BASE_URL}/market/news/alerts/${row.alertId}/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`Alert for ${row.symbol} removed`);
    } catch {
      toast.error("Failed to delete");
      fetchNewsAlerts();
    }
  };

  // ─── Create custom alert ──────────────────────────────────────────────────
  const createNewsAlert = async () => {
    if (!alertSymbol.trim()) { toast.error("Enter a symbol"); return; }
    setCreatingAlert(true);
    try {
      const res  = await authFetch(`${BASE_URL}/market/news/alerts/`, {
        method: "POST",
        body:   JSON.stringify({ symbol: alertSymbol.toUpperCase().trim(), keyword: alertKeyword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to create"); return; }
      setNewsAlerts(prev => [data, ...prev]);
      setAlertSymbol(""); setAlertKeyword(""); setShowAlertForm(false);
      toast.success(`News alert created for ${data.symbol}`);
    } catch { toast.error("Network error"); }
    finally   { setCreatingAlert(false); }
  };

  // ─── Digest ───────────────────────────────────────────────────────────────
  const toggleEmailDigest = async () => {
    setDigestLoading(true);
    try {
      const res  = await authFetch(`${BASE_URL}/market/news/digest/toggle/`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const v = data.enabled ?? !emailDigest;
      setEmailDigest(v);
      localStorage.setItem("alphascope_digest", String(v));
      toast.success(data.message ?? (v ? "Digest enabled." : "Digest disabled."));
    } catch {
      const v = !emailDigest;
      setEmailDigest(v);
      localStorage.setItem("alphascope_digest", String(v));
      toast.info(v ? "Digest toggled on locally." : "Digest toggled off.");
    } finally { setDigestLoading(false); }
  };

  const sendDigestNow = async () => {
    setSendingDigest(true);
    try {
      const res  = await authFetch(`${BASE_URL}/market/news/send-digest/`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) toast.error(data.error ?? "Failed");
      else         toast.success(data.message ?? "Digest triggered!");
    } catch { toast.error("Celery not running."); }
    finally   { setSendingDigest(false); }
  };

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered = news.filter(item => {
    const matchSym    = selectedSymbol === "ALL" || item.symbol === selectedSymbol;
    const matchSearch = !searchQuery
      || item.headline.toLowerCase().includes(searchQuery.toLowerCase())
      || item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      || (item.source ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchSym && matchSearch;
  });

  const sentimentCounts = filtered.reduce(
    (acc, item) => { acc[detectSentiment(item.headline)]++; return acc; },
    { positive: 0, negative: 0, neutral: 0 } as Record<Sentiment, number>
  );

  const watchlistRows = alertRows.filter(r => r.sources.includes("watchlist"));
  const portfolioRows = alertRows.filter(r => r.sources.includes("portfolio") && !r.sources.includes("watchlist"));
  const customRows    = alertRows.filter(r => r.sources.length === 1 && r.sources[0] === "custom");

  const renderSection = (title: string, icon: React.ReactNode, rows: AlertRow[], emptyMsg: string) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>{title}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isDarkMode ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"}`}>
          {rows.length}
        </span>
      </div>
      {rows.length === 0
        ? <p className={`text-xs italic ${textS}`}>{emptyMsg}</p>
        : rows.map(row => (
            <AlertRowItem
              key={row.symbol} row={row} isDarkMode={isDarkMode}
              toggling={togglingSyms.has(row.symbol)}
              onToggle={handleToggleRow}
              onDelete={handleDeleteRow}
            />
          ))
      }
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className={textS}>Loading your news feed…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${textP}`}>Market News</h1>
          <p className={`text-sm mt-1 ${textS}`}>Latest news for your watchlist and portfolio stocks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={toggleEmailDigest} disabled={digestLoading}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
              emailDigest
                ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                : isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {digestLoading ? <Loader2 className="w-4 h-4 animate-spin" />
              : emailDigest ? <MailCheck className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            <span className="hidden sm:inline">{emailDigest ? "Digest On" : "Daily Digest"}</span>
          </button>
          {emailDigest && (
            <button onClick={sendDigestNow} disabled={sendingDigest}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-green-400" : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {sendingDigest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline">Send Now</span>
            </button>
          )}
          <button onClick={() => fetchNews(true)} disabled={isRefreshing}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
              isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Sentiment */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(["positive","negative","neutral"] as Sentiment[]).map(key => {
            const meta = {
              positive: { Icon: TrendingUp,   label: "Bullish", color: "text-emerald-400", bg: "bg-emerald-500/10" },
              negative: { Icon: TrendingDown, label: "Bearish", color: "text-red-400",     bg: "bg-red-500/10"     },
              neutral:  { Icon: Minus,        label: "Neutral", color: "text-slate-400",   bg: "bg-slate-500/10"   },
            }[key];
            return (
              <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border ${cardBg}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg}`}>
                  <meta.Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold ${textP}`}>{sentimentCounts[key]}</p>
                  <p className={`text-xs ${textS}`}>{meta.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alerts Panel */}
      <div className={`rounded-xl border p-4 ${cardBg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <h2 className={`text-sm font-semibold ${textP}`}>
              News Alerts
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                {alertRows.length}
              </span>
            </h2>
          </div>
          <button onClick={() => setShowAlertForm(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-colors"
          >
            {showAlertForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAlertForm ? "Cancel" : "Add Alert"}
          </button>
        </div>

        {/* Info banner */}
        <div className={`mb-4 flex items-start gap-2 p-2.5 rounded-lg text-xs border ${
          isDarkMode ? "bg-slate-800/60 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
        }`}>
          <Bell className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
          Toggle the switch to pause or resume email alerts per stock.
          Watchlist and portfolio stocks are included automatically in the digest.
        </div>

        {/* Add alert form */}
        {showAlertForm && (
          <div className={`mb-4 p-3 rounded-xl border ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <p className={`text-xs mb-3 ${textS}`}>
              Track any stock not in your watchlist/portfolio. Optional keyword filter (e.g. "earnings").
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" value={alertSymbol} onChange={e => setAlertSymbol(e.target.value.toUpperCase())}
                placeholder="Symbol e.g. NVDA *"
                className={`flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
              />
              <input type="text" value={alertKeyword} onChange={e => setAlertKeyword(e.target.value)}
                placeholder="Keyword (optional)"
                className={`flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
              />
              <button onClick={createNewsAlert} disabled={creatingAlert || !alertSymbol.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                {creatingAlert ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </button>
            </div>
          </div>
        )}

        {/* 3 sections */}
        <div className={`space-y-5 divide-y ${isDarkMode ? "divide-slate-700/60" : "divide-slate-200"}`}>
          <div>
            {renderSection("Watchlist", <Star className="w-3.5 h-3.5 text-violet-400" />, watchlistRows, "No watchlist stocks yet.")}
          </div>
          <div className="pt-4">
            {renderSection("Portfolio", <Briefcase className="w-3.5 h-3.5 text-amber-400" />, portfolioRows, "No portfolio stocks yet.")}
          </div>
          <div className="pt-4">
            {renderSection("Custom Alerts", <Bell className="w-3.5 h-3.5 text-blue-400" />, customRows, "No custom alerts. Use 'Add Alert' to track any stock.")}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textS}`} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search headlines, symbols…"
            className={`w-full pl-10 pr-8 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className={`absolute right-3 top-1/2 -translate-y-1/2 ${textS}`}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {symbols.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className={`w-4 h-4 ${textS} flex-shrink-0`} />
            {["ALL", ...symbols].map(sym => (
              <button key={sym} onClick={() => setSelectedSymbol(sym)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedSymbol === sym
                    ? "bg-blue-600 border-blue-600 text-white"
                    : isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/50"
                                 : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* News Grid */}
      {filtered.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-16 gap-4 rounded-xl border ${cardBg}`}>
          <Newspaper className={`w-12 h-12 ${textS} opacity-30`} />
          <div className="text-center">
            <p className={`font-medium ${textP}`}>No news found</p>
            <p className={`text-sm mt-1 ${textS}`}>
              {news.length === 0 && !searchQuery ? "Add stocks to your watchlist or portfolio"
                : searchQuery ? `No articles match "${searchQuery}"` : `No articles for ${selectedSymbol}`}
            </p>
          </div>
          {news.length === 0 && (
            <div className={`flex items-start gap-2 max-w-sm p-3 rounded-xl border text-xs ${
              isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>Make sure <strong>FINNHUB_API_KEY</strong> is set in Django settings.</span>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className={`text-xs mb-4 ${textS}`}>
            {filtered.length} article{filtered.length !== 1 ? "s" : ""}
            {selectedSymbol !== "ALL" ? ` for ${selectedSymbol}` : ""}
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((item, i) => (
              <NewsCard key={item.url ?? i} item={item} isDarkMode={isDarkMode} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}