/**
 * Alerts.tsx — AlphaScope Price Alerts (FIXED)
 *
 * Fixes:
 *  1. Inactive alert Switch had checked={false} hardcoded — now uses alert.is_active
 *  2. Toggle handler is useCallback so it doesn't re-create on every render
 *  3. Inactive alert card shows same info as active (cooldown, last triggered)
 *  4. Create alert form resets properly after success
 *  5. Refresh button added
 *  6. Both active and inactive alerts show full details
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Bell, BellOff, Plus, Trash2, Loader2, Search,
  TrendingUp, TrendingDown, X, RefreshCw, Clock, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { authFetch, BASE_URL } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Alert {
  id:                number;
  symbol:            string;
  alert_type:        "price" | "percentage";
  condition:         "above" | "below";
  target_price:      number | null;
  percentage_change: number | null;
  is_active:         boolean;
  last_triggered_at: string | null;
  cooldown_minutes:  number;
  created_at:        string;
}

interface NewAlertForm {
  symbol:            string;
  alert_type:        "price" | "percentage";
  condition:         "above" | "below";
  target_price:      string;
  percentage_change: string;
  cooldown_minutes:  string;
}

const EMPTY_FORM: NewAlertForm = {
  symbol: "", alert_type: "price", condition: "above",
  target_price: "", percentage_change: "", cooldown_minutes: "30",
};

// ── Symbol Search ─────────────────────────────────────────────────────────────
function SymbolSearch({
  value, onChange, isDarkMode,
}: { value: string; onChange: (v: string) => void; isDarkMode: boolean }) {
  const [query,     setQuery]     = useState(value);
  const [results,   setResults]   = useState<{ symbol: string; name?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDrop,  setShowDrop]  = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const wrapRef     = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!value) { setQuery(""); setResults([]); setConfirmed(false); }
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase();
    setQuery(v); onChange(v); setConfirmed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await authFetch(`${BASE_URL}/market/search/?q=${encodeURIComponent(v)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.results ?? []);
        setResults(list.slice(0, 8));
        setShowDrop(list.length > 0);
      } catch { setResults([]); setShowDrop(false); }
      finally   { setSearching(false); }
    }, 350);
  };

  const select = (sym: string) => {
    setQuery(sym); onChange(sym); setConfirmed(true);
    setShowDrop(false); setResults([]);
  };

  const inputCls = isDarkMode
    ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
    : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400";

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text" value={query} onChange={handleInput}
          onFocus={() => results.length > 0 && setShowDrop(true)}
          placeholder="Search symbol e.g. AAPL, TSLA…"
          className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${inputCls}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {searching   ? <Loader2     className="w-4 h-4 animate-spin text-slate-400" />
          : confirmed && query ? <CheckCircle className="w-4 h-4 text-emerald-400" />
          : null}
        </div>
      </div>
      {showDrop && results.length > 0 && (
        <div className={`absolute z-50 w-full mt-1 rounded-xl border shadow-2xl overflow-hidden ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
        }`}>
          {results.map((r, i) => (
            <button key={`${r.symbol}-${i}`} type="button" onClick={() => select(r.symbol)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b last:border-0 ${
                isDarkMode ? "border-slate-700 hover:bg-slate-700 text-white"
                           : "border-slate-100 hover:bg-slate-50 text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  isDarkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
                }`}>{r.symbol.charAt(0)}</span>
                <div className="text-left">
                  <p className="font-bold text-sm">{r.symbol}</p>
                  {r.name && <p className={`text-xs truncate max-w-[180px] ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}>{r.name}</p>}
                </div>
              </div>
            </button>
          ))}
          <div className={`px-4 py-2 text-xs ${isDarkMode ? "text-slate-600 bg-slate-900/60" : "text-slate-400 bg-slate-50"}`}>
            Don't see it? Type the exact symbol (e.g. AAPL) and proceed.
          </div>
        </div>
      )}
      {confirmed && query && (
        <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Selected: <strong>{query}</strong>
        </p>
      )}
    </div>
  );
}

// ── Time helper ───────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)    return "just now";
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({
  checked, onChange, disabled,
}: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      title={checked ? "Deactivate alert" : "Activate alert"}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none disabled:opacity-50 ${
        checked ? "bg-blue-600 border-blue-500" : "bg-slate-600 border-slate-500"
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? "translate-x-5" : "translate-x-1"
      }`} />
    </button>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({
  alert, onToggle, onDelete, isDarkMode,
}: {
  alert:    Alert;
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isDarkMode: boolean;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const textP   = isDarkMode ? "text-white"     : "text-slate-900";
  const textS   = isDarkMode ? "text-slate-400" : "text-slate-500";
  const itemBg  = isDarkMode
    ? alert.is_active ? "bg-slate-800 border-slate-700" : "bg-slate-800/40 border-slate-800"
    : alert.is_active ? "bg-white border-slate-200"     : "bg-slate-50 border-slate-200";

  const value = alert.alert_type === "price"
    ? `$${Number(alert.target_price).toFixed(2)}`
    : `${alert.percentage_change}%`;

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(alert.id);
    setToggling(false);
  };
  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(alert.id);
    setDeleting(false);
  };

  return (
    <div className={`p-4 rounded-xl border transition-all ${itemBg} ${!alert.is_active ? "opacity-65" : ""}`}>
      <div className="flex items-start justify-between gap-3">

        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {/* Symbol */}
            <span className={`px-2 py-0.5 rounded-lg text-sm font-bold ${
              isDarkMode ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700"
            }`}>{alert.symbol}</span>

            {/* Condition */}
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              alert.condition === "above"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/15 text-red-400 border-red-500/20"
            }`}>
              {alert.condition === "above"
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {alert.condition === "above" ? "Above" : "Below"} {value}
            </span>

            {/* Type */}
            <span className={`px-2 py-0.5 rounded-full text-xs border ${
              isDarkMode
                ? "bg-slate-700 border-slate-600 text-slate-300"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}>
              {alert.alert_type === "price" ? "Price Alert" : "% Change"}
            </span>

            {/* Active pulse */}
            {alert.is_active && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <span className={`flex items-center gap-1 ${textS}`}>
              <Clock className="w-3 h-3" />
              Cooldown: <span className={`ml-0.5 font-medium ${textP}`}>{alert.cooldown_minutes}m</span>
            </span>
            {alert.last_triggered_at && (
              <span className={textS}>
                Triggered: <span className={textP}>{timeAgo(alert.last_triggered_at)}</span>
              </span>
            )}
            <span className={textS}>
              Created: <span className={textP}>{new Date(alert.created_at).toLocaleDateString()}</span>
            </span>
          </div>
        </div>

        {/* Right — toggle + delete */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* FIX: Use alert.is_active — NOT hardcoded false */}
          <ToggleSwitch
            checked={alert.is_active}
            onChange={handleToggle}
            disabled={toggling}
          />
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete alert"
            className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Alerts() {
  usePageTitle("Alerts");
  const { isDarkMode } = useTheme();

  const [alerts,     setAlerts]     = useState<Alert[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState<NewAlertForm>(EMPTY_FORM);
  const [formError,  setFormError]  = useState("");

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res  = await authFetch(`${BASE_URL}/market/alert/`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load alerts"); }
    finally   { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // ── Validate ───────────────────────────────────────────────────────────────
  const validate = (): string => {
    if (!form.symbol.trim())        return "Please select a stock symbol.";
    if (!/^[A-Z]{1,5}$/.test(form.symbol.trim())) return "Symbol must be 1–5 uppercase letters.";
    if (form.alert_type === "price") {
      if (!form.target_price)       return "Please enter a target price.";
      if (Number(form.target_price) <= 0) return "Target price must be positive.";
    }
    if (form.alert_type === "percentage") {
      if (!form.percentage_change)  return "Please enter a percentage.";
      if (Number(form.percentage_change) <= 0) return "Percentage must be positive.";
    }
    return "";
  };

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    setFormError(""); setIsCreating(true);
    try {
      const res = await authFetch(`${BASE_URL}/market/alert/`, {
        method: "POST",
        body: JSON.stringify({
          symbol:            form.symbol.toUpperCase().trim(),
          condition:         form.condition,
          alert_type:        form.alert_type,
          cooldown_minutes:  parseInt(form.cooldown_minutes) || 30,
          target_price:      form.alert_type === "price" ? parseFloat(form.target_price) : null,
          percentage_change: form.alert_type === "percentage" ? parseFloat(form.percentage_change) : null,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(Object.values(e).flat().join(", ") || "Failed");
      }
      const data = await res.json();
      setAlerts(prev => [data, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success(`✅ Alert created for ${data.symbol}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create alert";
      setFormError(msg);
    } finally { setIsCreating(false); }
  };

  // ── Toggle (FIX: sends explicit is_active) ─────────────────────────────────
  const handleToggle = useCallback(async (id: number) => {
    // Find current state
    const alert = alerts.find(a => a.id === id);
    if (!alert) return;
    const newValue = !alert.is_active;

    // Optimistic update
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: newValue } : a));

    try {
      const res  = await authFetch(`${BASE_URL}/market/alert/${id}/`, {
        method: "PATCH",
        // Send explicit is_active so backend sets it correctly
        body: JSON.stringify({ is_active: newValue }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Sync with server response
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: data.is_active } : a));
      toast.success(data.message ?? (data.is_active ? "Alert activated" : "Alert deactivated"));
    } catch {
      // Rollback
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: !newValue } : a));
      toast.error("Failed to update alert");
    }
  }, [alerts]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: number) => {
    try {
      const res = await authFetch(`${BASE_URL}/market/alert/${id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success("Alert deleted");
    } catch { toast.error("Failed to delete alert"); }
  }, []);

  const active   = useMemo(() => alerts.filter(a =>  a.is_active), [alerts]);
  const inactive = useMemo(() => alerts.filter(a => !a.is_active), [alerts]);

  const cardBg    = isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const inputCls  = isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                               : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400";
  const selectCls = isDarkMode ? "bg-slate-800 border-slate-700 text-white"
                               : "bg-white border-slate-300 text-slate-900";
  const labelCls  = isDarkMode ? "text-slate-400" : "text-slate-500";
  const textP     = isDarkMode ? "text-white"     : "text-slate-900";
  const textS     = isDarkMode ? "text-slate-400" : "text-slate-500";

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-3">
      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      <p className={textS}>Loading alerts…</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${textP}`}>Stock Alerts</h1>
          <p className={`text-sm mt-1 ${textS}`}>
            {alerts.length} total · {active.length} active · {inactive.length} paused
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAlerts}
            className={`p-2 rounded-xl border transition-colors ${
              isDarkMode ? "border-slate-700 text-slate-400 hover:text-white" : "border-slate-200 text-slate-500 hover:text-slate-900"
            }`} title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowForm(v => !v); setFormError(""); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Create Alert"}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className={`rounded-2xl border p-5 space-y-4 ${cardBg}`}>
          <h2 className={`text-base font-semibold ${textP}`}>New Price Alert</h2>
          {formError && (
            <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
              <X className="w-4 h-4 flex-shrink-0 mt-0.5" /> {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>Stock Symbol *</label>
              <SymbolSearch
                value={form.symbol}
                onChange={v => { setForm(f => ({ ...f, symbol: v })); setFormError(""); }}
                isDarkMode={isDarkMode}
              />
              <p className={`text-xs mt-1 ${textS}`}>Search by name or type the symbol directly</p>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>Alert Type *</label>
              <select value={form.alert_type}
                onChange={e => setForm(f => ({ ...f, alert_type: e.target.value as "price"|"percentage", target_price: "", percentage_change: "" }))}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${selectCls}`}
              >
                <option value="price">Price Alert ($)</option>
                <option value="percentage">Percentage Change (%)</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>Condition *</label>
              <select value={form.condition}
                onChange={e => setForm(f => ({ ...f, condition: e.target.value as "above"|"below" }))}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${selectCls}`}
              >
                <option value="above">↑ Price goes above</option>
                <option value="below">↓ Price goes below</option>
              </select>
            </div>

            {form.alert_type === "price" && (
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>Target Price ($) *</label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${textS}`}>$</span>
                  <input type="number" min="0.01" step="0.01" value={form.target_price}
                    onChange={e => setForm(f => ({ ...f, target_price: e.target.value }))}
                    placeholder="0.00"
                    className={`w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
                  />
                </div>
              </div>
            )}

            {form.alert_type === "percentage" && (
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>Percentage Change (%) *</label>
                <div className="relative">
                  <input type="number" min="0.1" step="0.1" value={form.percentage_change}
                    onChange={e => setForm(f => ({ ...f, percentage_change: e.target.value }))}
                    placeholder="5.0"
                    className={`w-full pr-8 pl-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${textS}`}>%</span>
                </div>
              </div>
            )}

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>Cooldown</label>
              <select value={form.cooldown_minutes}
                onChange={e => setForm(f => ({ ...f, cooldown_minutes: e.target.value }))}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${selectCls}`}
              >
                <option value="15">Every 15 minutes</option>
                <option value="30">Every 30 minutes</option>
                <option value="60">Every 1 hour</option>
                <option value="120">Every 2 hours</option>
                <option value="360">Every 6 hours</option>
                <option value="1440">Once per day</option>
              </select>
            </div>
          </div>

          {form.symbol && (form.target_price || form.percentage_change) && (
            <div className={`px-4 py-3 rounded-xl border text-sm ${
              isDarkMode ? "bg-blue-500/5 border-blue-500/20 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-700"
            }`}>
              📌 Notify me when <strong>{form.symbol}</strong> goes {form.condition}{" "}
              {form.alert_type === "price" ? `$${form.target_price}` : `${form.percentage_change}%`}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={isCreating || !form.symbol}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Bell className="w-4 h-4" /> Create Alert</>}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(""); }}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                isDarkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      <div className={`rounded-2xl border ${cardBg}`}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-inherit">
          <Bell className="w-4 h-4 text-blue-400" />
          <h2 className={`font-semibold ${textP}`}>Active Alerts</h2>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
            {active.length}
          </span>
        </div>
        <div className="p-4">
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <BellOff className={`w-8 h-8 ${textS}`} />
              <p className={`font-medium ${textP}`}>No active alerts</p>
              <p className={`text-sm ${textS}`}>Click "Create Alert" to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map(a => (
                <AlertCard key={a.id} alert={a}
                  onToggle={handleToggle} onDelete={handleDelete} isDarkMode={isDarkMode} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inactive / Paused Alerts */}
      {inactive.length > 0 && (
        <div className={`rounded-2xl border ${cardBg}`}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-inherit">
            <BellOff className={`w-4 h-4 ${textS}`} />
            <h2 className={`font-semibold ${textP}`}>Paused Alerts</h2>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
            }`}>
              {inactive.length}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {inactive.map(a => (
              /* FIX: Pass alert as-is — AlertCard reads alert.is_active correctly */
              <AlertCard key={a.id} alert={a}
                onToggle={handleToggle} onDelete={handleDelete} isDarkMode={isDarkMode} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {alerts.length === 0 && !showForm && (
        <div className={`rounded-2xl border p-12 flex flex-col items-center gap-4 text-center ${cardBg}`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
            isDarkMode ? "bg-slate-800" : "bg-blue-50"
          }`}>
            <Bell className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <p className={`text-lg font-semibold ${textP}`}>No alerts yet</p>
            <p className={`text-sm mt-1 max-w-sm ${textS}`}>
              Create a price alert to get email notifications when a stock reaches your target.
              Your Celery task checks prices every 5 minutes.
            </p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Your First Alert
          </button>
        </div>
      )}
    </div>
  );
}
