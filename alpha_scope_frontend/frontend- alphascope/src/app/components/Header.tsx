import { useState, useEffect, useRef, useCallback } from "react"
import { Search, User, Moon, Sun, LogOut, ChevronDown, X, Wifi, WifiOff } from "lucide-react"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "../context/useAuth"
import { useNavigate } from "react-router-dom"
import { getMarketStatus, searchStocksAPI } from "../lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────
interface SearchResult  { symbol: string; name: string; exchange: string; sector: string }
interface MarketStatus  { status: string; is_open: boolean }
interface TickerItem    { symbol: string; price: number; change: number; changePct: number }

// ── Constants ─────────────────────────────────────────────────────────────────
const TICKER_SYMBOLS = ["AAPL","MSFT","NVDA","TSLA","GOOGL","AMZN","META","SPY","QQQ","AMD"]

const SEED_PRICES: Record<string, TickerItem> = {
  AAPL:  { symbol:"AAPL",  price:175.43, change: 2.34,  changePct: 1.35 },
  MSFT:  { symbol:"MSFT",  price:412.78, change: 5.67,  changePct: 1.39 },
  NVDA:  { symbol:"NVDA",  price:878.45, change: 23.12, changePct: 2.70 },
  TSLA:  { symbol:"TSLA",  price:267.89, change:-3.45,  changePct:-1.27 },
  GOOGL: { symbol:"GOOGL", price:175.12, change: 1.23,  changePct: 0.71 },
  AMZN:  { symbol:"AMZN",  price:182.54, change: 3.45,  changePct: 1.93 },
  META:  { symbol:"META",  price:512.33, change: 8.12,  changePct: 1.61 },
  SPY:   { symbol:"SPY",   price:523.45, change: 2.34,  changePct: 0.45 },
  QQQ:   { symbol:"QQQ",   price:443.12, change:-1.23,  changePct:-0.28 },
  AMD:   { symbol:"AMD",   price:165.43, change: 4.56,  changePct: 2.83 },
}

// ── Ticker Tape ───────────────────────────────────────────────────────────────
function TickerTape({ tickers, wsLive }: { tickers: TickerItem[]; wsLive: boolean }) {
  const items = [...tickers, ...tickers]

  return (
    <div className="h-8 bg-slate-950 border-b border-slate-800 overflow-hidden relative flex items-center select-none">
      {/* WS status indicator */}
      <div className="absolute left-0 top-0 bottom-0 flex items-center pl-2 pr-2 bg-slate-950 z-10 border-r border-slate-800 flex-shrink-0">
        {wsLive
          ? <Wifi    className="w-3 h-3 text-emerald-400" />
          : <WifiOff className="w-3 h-3 text-slate-600"   />
        }
      </div>

      {/* Scrolling strip */}
      <div
        className="flex items-center gap-6 whitespace-nowrap pl-9"
        style={{ animation: "tickerScroll 40s linear infinite" }}
      >
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-slate-300 tracking-wide">{t.symbol}</span>
            <span className="text-white font-mono">${t.price.toFixed(2)}</span>
            <span className={`font-semibold ${t.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {/* Fade edges */}
      <div className="absolute left-8  top-0 bottom-0 w-6 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none z-10" />

      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

// ── Main Header ───────────────────────────────────────────────────────────────
export default function Header() {
  const { isDarkMode, toggleTheme } = useTheme()
  const { user, logout }            = useAuth()
  const navigate                    = useNavigate()

  const [marketStatus,  setMarketStatus]  = useState<MarketStatus>({ status: "Loading…", is_open: false })
  const [searchQuery,   setSearchQuery]   = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown,  setShowDropdown]  = useState(false)
  const [showSearch,    setShowSearch]    = useState(false)
  const [currentTime,   setCurrentTime]   = useState(new Date())
  const [tickers,       setTickers]       = useState<TickerItem[]>(Object.values(SEED_PRICES))
  const [wsLive,        setWsLive]        = useState(false)

  const searchRef      = useRef<HTMLDivElement>(null)
  const dropdownRef    = useRef<HTMLDivElement>(null)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const wsRef          = useRef<WebSocket | null>(null)
  const priceMapRef    = useRef<Record<string, TickerItem>>({ ...SEED_PRICES })

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Market status ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchStatus = async () => {
      try { setMarketStatus(await getMarketStatus()) } catch { /* silent */ }
    }
    fetchStatus()
    const t = setInterval(fetchStatus, 60000)
    return () => clearInterval(t)
  }, [])

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    wsRef.current?.close()
    setWsLive(false)
    const symbols = TICKER_SYMBOLS.join(",")
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/prices/?symbols=${symbols}`)
    ws.onopen  = () => setWsLive(true)
    ws.onclose = () => { setWsLive(false); setTimeout(connectWS, 5000) }
    ws.onerror = () => setWsLive(false)
    ws.onmessage = (e) => {
      try {
        const data      = JSON.parse(e.data)
        const sym       = data.symbol ?? data.s
        const price     = Number(data.price ?? data.p ?? 0)
        if (!sym || !price) return
        const prev      = priceMapRef.current[sym]
        const change    = prev ? price - prev.price : 0
        const changePct = prev && prev.price > 0 ? (change / prev.price) * 100 : 0
        const updated: TickerItem = {
          symbol: sym, price,
          change:    prev ? prev.change    + change    * 0.1 : change,
          changePct: prev ? prev.changePct + changePct * 0.1 : changePct,
        }
        priceMapRef.current = { ...priceMapRef.current, [sym]: updated }
        setTickers(Object.values(priceMapRef.current))
      } catch { /* ignore */ }
    }
    wsRef.current = ws
  }, [])

  useEffect(() => {
    connectWS()
    return () => wsRef.current?.close()
  }, [connectWS])

  // ── REST fallback quotes ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchQuotes = async () => {
      const { authFetch, BASE_URL } = await import("../lib/api")
      for (const sym of TICKER_SYMBOLS.slice(0, 5)) {
        try {
          const res  = await authFetch(`${BASE_URL}/market/stocks/${sym}/`)
          if (!res.ok) continue
          const data  = await res.json()
          const price = Number(data.price ?? 0)
          if (!price) continue
          priceMapRef.current[sym] = {
            symbol: sym, price,
            change:    Number(data.change     ?? 0),
            changePct: Number(data.change_pct ?? 0),
          }
        } catch { /* skip */ }
      }
      setTickers(Object.values(priceMapRef.current))
    }
    fetchQuotes()
    const t = setInterval(fetchQuotes, 30000)
    return () => clearInterval(t)
  }, [])

  // ── Outside-click handlers ────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchResults([])
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  useEffect(() => {
    if (showSearch) {
      // Lock body scroll while mobile search is open
      document.body.style.overflow = "hidden"
      setTimeout(() => mobileInputRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [showSearch])

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = (q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchStocksAPI(q)
        setSearchResults(Array.isArray(r) ? r.slice(0, 6) : [])
      } catch { setSearchResults([]) }
    }, 400)
  }

  const handleSelectStock = (s: SearchResult) => {
    setSearchQuery(""); setSearchResults([]); setShowSearch(false)
    navigate(`/trading?symbol=${s.symbol}`)
  }

  const handleLogout = () => { logout(); navigate("/login") }

  const closeMobileSearch = () => {
    setShowSearch(false)
    setSearchQuery("")
    setSearchResults([])
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const headerBg = isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
  const inputCls = isDarkMode
    ? "bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
    : "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
  const dropBg   = isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
  const hoverRow = isDarkMode ? "hover:bg-slate-700 border-slate-700" : "hover:bg-slate-50 border-slate-200"

  // ── Desktop search dropdown ───────────────────────────────────────────────
  const SearchDropdown = () => searchResults.length > 0 ? (
    <div className={`absolute z-50 w-full mt-1 rounded-xl shadow-xl overflow-hidden border ${dropBg}`}>
      {searchResults.map(s => (
        <div key={s.symbol} onClick={() => handleSelectStock(s)}
          className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b last:border-0 transition-colors ${hoverRow}`}>
          <div className="min-w-0">
            <p className={`font-bold text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>{s.symbol}</p>
            <p className={`text-xs truncate max-w-[180px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{s.name}</p>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <p className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{s.exchange}</p>
            <p className={`text-xs ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>{s.sector}</p>
          </div>
        </div>
      ))}
    </div>
  ) : null

  return (
    <>
      {/* ── Ticker tape ────────────────────────────────────────────────────── */}
      <TickerTape tickers={tickers} wsLive={wsLive} />

      {/* ── Main header bar ────────────────────────────────────────────────── */}
      <header className={`h-14 border-b flex items-center px-3 md:px-5 gap-2 md:gap-4 ${headerBg}`}>

        {/* Desktop search */}
        <div ref={searchRef} className="relative flex-1 max-w-xl hidden md:block">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search stocks (e.g., AAPL, TSLA)..."
            className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border transition-colors ${inputCls}`}
          />
          <SearchDropdown />
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 ml-auto">

          {/* Mobile: search icon */}
          <button
            onClick={() => setShowSearch(true)}
            aria-label="Open search"
            className={`md:hidden p-2 rounded-xl transition-colors ${isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          {/* Market status — desktop: full, mobile: dot only */}
          <div className="hidden md:flex flex-col items-end leading-none gap-0.5">
            <p className={`text-xs tabular-nums font-mono ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {currentTime.toLocaleTimeString()}
            </p>
            <p className={`text-xs font-semibold flex items-center gap-1 ${marketStatus.is_open ? "text-emerald-400" : "text-red-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${marketStatus.is_open ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              {marketStatus.status}
            </p>
          </div>

          {/* Mobile: market status — compact pill */}
          <div className="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg border
            border-transparent">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${marketStatus.is_open ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`text-xs font-semibold hidden xs:inline ${marketStatus.is_open ? "text-emerald-400" : "text-red-400"}`}>
              {marketStatus.is_open ? "Open" : "Closed"}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`p-2 rounded-xl transition-colors ${isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {isDarkMode
              ? <Sun  className="w-[18px] h-[18px]" />
              : <Moon className="w-[18px] h-[18px]" />}
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(v => !v)}
              className={`flex items-center gap-1 p-1.5 rounded-xl transition-colors ${isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              {/* Hide chevron on very small screens to save space */}
              <ChevronDown className={`w-3.5 h-3.5 hidden xs:block transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`} />
            </button>

            {showDropdown && (
              <div className={`absolute right-0 mt-2 w-52 rounded-xl shadow-xl border z-50 overflow-hidden ${dropBg}`}>
                <div className={`px-4 py-3 border-b ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
                  <p className={`font-semibold text-sm truncate ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {user?.username || user?.name || "My Account"}
                  </p>
                  <p className={`text-xs mt-0.5 truncate ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {user?.email || ""}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/5 text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile full-screen search overlay ──────────────────────────────── */}
      {showSearch && (
        <div className={`fixed inset-0 z-[9990] flex flex-col md:hidden ${isDarkMode ? "bg-slate-900" : "bg-white"}`}>

          {/* Search input row */}
          <div className={`flex items-center gap-3 px-4 py-3 border-b flex-shrink-0 ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
            <Search className={`w-5 h-5 flex-shrink-0 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
            <input
              ref={mobileInputRef}
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search stocks (e.g., AAPL, TSLA)..."
              className={`flex-1 min-w-0 bg-transparent text-sm focus:outline-none ${isDarkMode ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"}`}
            />
            <button
              onClick={closeMobileSearch}
              aria-label="Close search"
              className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${isDarkMode ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results / empty states */}
          <div className="flex-1 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map(s => (
                <div
                  key={s.symbol}
                  onClick={() => handleSelectStock(s)}
                  className={`flex items-center justify-between px-4 py-4 border-b cursor-pointer transition-colors ${isDarkMode ? "border-slate-800 hover:bg-slate-800" : "border-slate-100 hover:bg-slate-50"}`}
                >
                  <div className="min-w-0">
                    <p className={`font-bold text-base ${isDarkMode ? "text-white" : "text-slate-900"}`}>{s.symbol}</p>
                    <p className={`text-sm mt-0.5 truncate ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{s.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{s.exchange}</p>
                  </div>
                </div>
              ))
            ) : searchQuery ? (
              /* No results */
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Search className={`w-10 h-10 ${isDarkMode ? "text-slate-700" : "text-slate-300"}`} />
                <p className={`text-sm ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  No results for "{searchQuery}"
                </p>
              </div>
            ) : (
              /* Popular shortcuts */
              <div className="px-4 py-5">
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  Popular stocks
                </p>
                <div className="flex flex-wrap gap-2">
                  {TICKER_SYMBOLS.map(sym => (
                    <button
                      key={sym}
                      onClick={() => { closeMobileSearch(); navigate(`/trading?symbol=${sym}`) }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        isDarkMode
                          ? "border-slate-700 text-slate-300 hover:border-blue-500 hover:text-blue-300 active:bg-slate-800"
                          : "border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 active:bg-slate-50"
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {/* Show market status + time in overlay when on mobile */}
                <div className={`mt-6 p-3 rounded-xl border ${isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-xs font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Market Status</p>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold flex items-center gap-2 ${marketStatus.is_open ? "text-emerald-400" : "text-red-400"}`}>
                      <span className={`w-2 h-2 rounded-full ${marketStatus.is_open ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                      {marketStatus.status}
                    </p>
                    <p className={`text-xs tabular-nums font-mono ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      {currentTime.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}