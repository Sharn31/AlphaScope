import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Star, TrendingUp,
  Bell, Newspaper, Menu, X, Settings,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { authFetch, BASE_URL } from "../lib/api";
import Logo from "./Logo";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase },
  { path: "/watchlist", label: "Watchlist", icon: Star },
  { path: "/trading", label: "Trading", icon: TrendingUp },
  { path: "/alerts", label: "Alerts", icon: Bell },
  { path: "/news", label: "News", icon: Newspaper },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const [balance, setBalance] = useState<number | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Fetch Paper Balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await authFetch(`${BASE_URL}/market/trades/summary/`);
        if (res.ok) {
          const data = await res.json();
          setBalance(data.paper_balance ?? null);
        }
      } catch (err) {
        console.error("Balance fetch failed");
      }
    };
    fetchBalance();
  }, [location.pathname]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobileOpen]);

  const formattedBalance =
    balance !== null
      ? balance.toLocaleString(undefined, { minimumFractionDigits: 2 })
      : "0.00";

  // ── Shared class fragments ──────────────────────────────────────────────────
  const sidebarBg   = isDarkMode ? "bg-slate-900  border-slate-800" : "bg-white border-slate-200";
  const navText     = isDarkMode ? "text-slate-300" : "text-slate-600";
  const navHover    = isDarkMode ? "hover:bg-slate-800 hover:text-white" : "hover:bg-slate-100 hover:text-slate-900";
  const balanceBg   = isDarkMode ? "bg-slate-800"  : "bg-slate-100";
  const balanceMeta = isDarkMode ? "text-slate-400" : "text-slate-500";
  const divider     = isDarkMode ? "border-slate-800" : "border-slate-200";
  const hamburgerHover = isDarkMode
    ? "hover:bg-slate-800 text-slate-300"
    : "hover:bg-slate-100 text-slate-600";

  return (
    <>
      {/* ── Mobile Top Bar ─────────────────────────────────────────────────── */}
      <div
        className={`md:hidden fixed top-0 left-0 right-0 z-50 border-b ${sidebarBg}`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Logo size="sm" showText={true} />
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label={isMobileOpen ? "Close menu" : "Open menu"}
            className={`p-2 rounded-lg transition-colors ${hamburgerHover}`}
          >
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Overlay ─────────────────────────────────────────────────── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:static top-0 left-0 h-screen w-64 flex flex-col z-50
          transition-transform duration-300 ease-in-out border-r
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${sidebarBg}
        `}
      >
        {/* Logo — Desktop only */}
        <div className={`hidden md:block p-6 border-b ${divider}`}>
          <Logo size="md" showText={true} />
        </div>

        {/* Spacer so nav doesn't sit under logo on mobile */}
        <div className="md:hidden h-[57px] shrink-0" />

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto space-y-1">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path);

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-all duration-150
                      ${isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : `${navText} ${navHover}`
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Paper Trading Balance */}
        <div className={`p-4 border-t ${divider} mt-auto`}>
          <div className={`${balanceBg} rounded-2xl p-4`}>
            <p className={`text-xs ${balanceMeta}`}>Paper Trading Balance</p>
            <p className="text-2xl font-bold text-emerald-500 mt-1 tabular-nums">
              ${formattedBalance}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Mobile content offset ──────────────────────────────────────────── */}
      {/* Add this div as a sibling/wrapper nudge in your layout if needed:    */}
      {/* <div className="md:hidden h-[57px]" /> in the page layout            */}
    </>
  );
}