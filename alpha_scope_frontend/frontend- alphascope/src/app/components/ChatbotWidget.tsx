import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Maximize2, Minimize2, Send, Bot,
  TrendingUp, BarChart2, Newspaper, Wallet,
  Loader2, Sparkles, Search, Trash2, Clock, ChevronRight,
} from "lucide-react";
import { authFetch, BASE_URL } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

interface QuickPrompt {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Portfolio summary",  prompt: "Give me a summary of my portfolio performance and P&L" },
  { icon: <BarChart2  className="w-3.5 h-3.5" />, label: "AAPL analysis",      prompt: "What is the current technical analysis for AAPL?" },
  { icon: <Newspaper  className="w-3.5 h-3.5" />, label: "Market news",        prompt: "What are the biggest market movers and news today?" },
  { icon: <Wallet     className="w-3.5 h-3.5" />, label: "Best trade",         prompt: "Based on my watchlist, which stock looks best to buy today?" },
  { icon: <Search     className="w-3.5 h-3.5" />, label: "Search TSLA",        prompt: "Search for latest news and price analysis on TSLA" },
  { icon: <Sparkles   className="w-3.5 h-3.5" />, label: "Portfolio risk",     prompt: "What are the biggest risks in my current portfolio holdings?" },
];

// ─── Get current user ID from JWT ────────────────────────────────────────────
// Used to namespace localStorage so each user has separate chat history.

function getCurrentUserId(): string {
  try {
    const token = localStorage.getItem("jwt_token");
    if (!token) return "guest";
    // JWT payload is base64-encoded in the second segment
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Django SimpleJWT uses "user_id", some use "sub"
    return String(payload.user_id ?? payload.sub ?? payload.id ?? "guest");
  } catch {
    return "guest";
  }
}

function storageKey(): string {
  return `alphascope_chat_${getCurrentUserId()}`;
}

// ─── Storage helpers — keyed per user ────────────────────────────────────────

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return parsed.map(s => ({
      ...s,
      createdAt: new Date(s.createdAt),
      messages:  s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(sessions.slice(0, 20)));
  } catch { /* storage full */ }
}

// ─── Page context ─────────────────────────────────────────────────────────────

function usePageContext(): string {
  const { pathname } = useLocation();
  if (pathname.includes("dashboard"))  return "Dashboard — portfolio overview, P&L, AI signals";
  if (pathname.includes("trading"))    return "Trading — live prices, charts, buy/sell orders";
  if (pathname.includes("portfolio"))  return "Portfolio — holdings, gains/losses, positions";
  if (pathname.includes("watchlist"))  return "Watchlist — tracked stocks with live prices";
  if (pathname.includes("news"))       return "News — market news and sentiment";
  if (pathname.includes("alerts"))     return "Alerts — price and percentage change alerts";
  if (pathname.includes("settings"))   return "Settings — account preferences";
  return "AlphaScope trading platform";
}

function makeTitle(content: string): string {
  return content.length > 42 ? content.slice(0, 42) + "…" : content;
}

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return d.toLocaleDateString();
}

// ─── Message renderer ─────────────────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  return (
    <div className="space-y-1">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-semibold text-white">{line.slice(2, -2)}</p>;
        if (line.startsWith("• ") || line.startsWith("- "))
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5 flex-shrink-0 text-xs leading-5">▸</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        if (/^\d+\./.test(line)) return <p key={i} className="pl-3">{line}</p>;
        if (line === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ─── AlphaScope AI logo mark ──────────────────────────────────────────────────
// Used in the floating button — a clean "A" monogram with chart pulse line

function AILogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* "A" letterform */}
      <path d="M12 3L3 19.5H7L12 8.5L17 19.5H21L12 3Z" fill="white" fillOpacity="0.95" />
      {/* Cross bar */}
      <path d="M8.5 14.5H15.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7" />
      {/* Small pulse dot bottom */}
      <circle cx="12" cy="19.5" r="1.2" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function ChatbotWidget() {
  const pageContext = usePageContext();

  const [isOpen,       setIsOpen]       = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view,         setView]         = useState<"chat" | "history">("chat");

  // Load sessions lazily — after mount so storageKey() uses the correct JWT
  const [sessions,      setSessions]      = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  const [input,     setInput]     = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const abortRef       = useRef<AbortController | null>(null);

  // ── Load sessions on mount (after JWT is available) ──────────────────────
  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    setSessionsLoaded(true);
  }, []);

  // ── Persist sessions whenever they change (after initial load) ────────────
  useEffect(() => {
    if (sessionsLoaded) saveSessions(sessions);
  }, [sessions, sessionsLoaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, isLoading]);

  useEffect(() => {
    if (isOpen && view === "chat") setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen, view]);

  const startNewSession = useCallback(() => {
    const welcome: Message = {
      id: "welcome", role: "assistant", timestamp: new Date(),
      content: "Hi! I'm your AlphaScope AI assistant.\n\nI can help you analyze stocks, explain your portfolio, search for market news, and answer trading questions.\n\nWhat would you like to know?",
    };
    const session: ChatSession = {
      id: crypto.randomUUID(), title: "New conversation",
      messages: [welcome], createdAt: new Date(),
    };
    setActiveSession(session);
    setView("chat");
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    if (!activeSession) {
      if (sessions.length > 0) setActiveSession(sessions[0]);
      else startNewSession();
    }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    let session = activeSession;
    if (!session) {
      const welcome: Message = { id: "welcome", role: "assistant", timestamp: new Date(), content: "How can I help you?" };
      session = { id: crypto.randomUUID(), title: makeTitle(content), messages: [welcome], createdAt: new Date() };
    }

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "22px";

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    const updated: ChatSession = {
      ...session,
      title:    session.messages.length <= 1 ? makeTitle(content) : session.title,
      messages: [...session.messages, userMsg],
    };
    setActiveSession(updated);
    setSessions(prev => {
      const exists = prev.find(s => s.id === updated.id);
      return exists ? prev.map(s => s.id === updated.id ? updated : s) : [updated, ...prev];
    });

    setIsLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res  = await authFetch(`${BASE_URL}/market/chat/`, {
        method: "POST",
        body:   JSON.stringify({ message: content, context: `User is on: ${pageContext}` }),
        signal: abortRef.current.signal,
      });
      const data  = await res.json();
      const reply = data.reply || data.error || "Sorry, I couldn't process that.";
      const aiMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: reply, timestamp: new Date() };
      const final = { ...updated, messages: [...updated.messages, aiMsg] };
      setActiveSession(final);
      setSessions(prev => prev.map(s => s.id === final.id ? final : s));
    } catch (e: any) {
      if (e.name === "AbortError") return;
      const errMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong. Please try again.", timestamp: new Date() };
      const errSession = { ...updated, messages: [...updated.messages, errMsg] };
      setActiveSession(errSession);
      setSessions(prev => prev.map(s => s.id === errSession.id ? errSession : s));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeSession, pageContext]);

  const loadSession   = (s: ChatSession) => { setActiveSession(s); setView("chat"); };
  const deleteSession = (id: string) => {
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    if (activeSession?.id === id) {
      if (remaining.length > 0) setActiveSession(remaining[0]);
      else startNewSession();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const messages      = activeSession?.messages ?? [];
  const showQuickTips = messages.length <= 1;

  const panelCls = isFullscreen
    ? "fixed inset-0 z-50 rounded-none"
    : "fixed bottom-6 right-6 z-50 w-[420px] h-[650px] rounded-2xl";

  return (
    <>
      {/* ── Floating trigger button ─────────────────────────────────────── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.93 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 group"
            aria-label="Open AlphaScope AI"
          >
            {/* Button body */}
            <div className="relative flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/50 hover:border-slate-600 transition-all">

              {/* Icon container */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                <AILogoMark size={18} />
              </div>

              {/* Label */}
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">AI Assistant</p>
                <p className="text-xs text-slate-400">Ask anything</p>
              </div>

              {/* Online dot */}
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 shadow" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={`${panelCls} flex flex-col overflow-hidden bg-slate-950 border border-slate-700/60 shadow-2xl shadow-black/70`}
          >

            {/* ── Panel header ──────────────────────────────────────────── */}
            <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-slate-800 bg-slate-900/90 flex-shrink-0">

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <AILogoMark size={16} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-none">AlphaScope AI</p>
                <p className="text-xs text-emerald-400 mt-0.5 leading-none flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Online
                </p>
              </div>

              {/* Chat / History tabs */}
              <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 flex-shrink-0">
                {(["chat", "history"] as const).map(tab => (
                  <button key={tab} onClick={() => setView(tab)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                      view === tab
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}>
                    {tab === "history" && <Clock className="w-3 h-3" />}
                    {tab === "chat" ? "Chat" : `History${sessions.length > 0 ? ` (${sessions.length})` : ""}`}
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => { startNewSession(); setView("chat"); }}
                  className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  + New
                </button>
                <button onClick={() => setIsFullscreen(v => !v)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { setIsOpen(false); setIsFullscreen(false); }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── CHAT VIEW ──────────────────────────────────────────────── */}
            {view === "chat" && (
              <>
                {/* Page context banner */}
                <div className="px-4 py-1.5 bg-slate-900/50 border-b border-slate-800/40 flex-shrink-0">
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    {pageContext}
                  </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {messages.map((msg) => (
                    <motion.div key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16 }}
                      className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow shadow-blue-500/20">
                          <AILogoMark size={14} />
                        </div>
                      )}
                      <div className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-tr-sm shadow-lg shadow-blue-500/20"
                          : "bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700/40"
                      }`}>
                        {msg.role === "assistant"
                          ? <MessageContent content={msg.content} />
                          : <p>{msg.content}</p>}
                        <p className={`text-xs mt-1.5 ${
                          msg.role === "user" ? "text-blue-200/50 text-right" : "text-slate-600"
                        }`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  {isLoading && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AILogoMark size={14} />
                      </div>
                      <div className="bg-slate-800/80 rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-700/40">
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map(i => (
                            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400"
                              animate={{ y: [0, -5, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick prompts — shown only on new/empty chat */}
                <AnimatePresence>
                  {showQuickTips && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-3 flex-shrink-0"
                    >
                      <p className="text-xs text-slate-600 mb-2 font-medium">Quick actions</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {QUICK_PROMPTS.map((qp) => (
                          <button key={qp.label} onClick={() => sendMessage(qp.prompt)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/40 hover:border-blue-500/30 text-left transition-all group">
                            <span className="text-blue-400 group-hover:text-blue-300 flex-shrink-0">{qp.icon}</span>
                            <span className="text-xs text-slate-400 group-hover:text-white truncate">{qp.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input */}
                <div className="px-4 pb-4 pt-2 border-t border-slate-800/50 flex-shrink-0">
                  <div className="flex items-end gap-2 bg-slate-800/40 rounded-2xl border border-slate-700/50 focus-within:border-blue-500/40 transition-colors px-3 py-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about stocks, portfolio, news…"
                      rows={1}
                      disabled={isLoading}
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 resize-none outline-none leading-relaxed py-0.5 min-h-[22px] max-h-[100px] disabled:opacity-50"
                      style={{ height: "22px" }}
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isLoading}
                      className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center disabled:opacity-30 hover:from-blue-500 hover:to-violet-500 transition-all shadow shadow-blue-500/20 disabled:shadow-none"
                    >
                      {isLoading
                        ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                        : <Send    className="w-3.5 h-3.5 text-white" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 mt-1.5 text-center">
                    Enter to send · Shift+Enter for new line
                  </p>
                </div>
              </>
            )}

            {/* ── HISTORY VIEW ───────────────────────────────────────────── */}
            {view === "history" && (
              <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                    <Clock className="w-10 h-10 text-slate-700" />
                    <p className="text-slate-500 text-sm">No chat history yet</p>
                    <button
                      onClick={() => { startNewSession(); setView("chat"); }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                    >
                      Start a conversation
                    </button>
                  </div>
                ) : (
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between px-2 py-1 mb-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Your Conversations
                      </p>
                      <button
                        onClick={() => { setSessions([]); startNewSession(); }}
                        className="text-xs text-red-500/70 hover:text-red-400 transition-colors"
                      >
                        Clear all
                      </button>
                    </div>

                    {sessions.map((session) => (
                      <motion.div key={session.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`group flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                          activeSession?.id === session.id
                            ? "bg-blue-600/10 border-blue-500/30"
                            : "bg-slate-800/30 border-slate-700/20 hover:bg-slate-800/60 hover:border-slate-600/40"
                        }`}
                        onClick={() => loadSession(session)}
                      >
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/15 to-violet-600/15 border border-slate-700/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            activeSession?.id === session.id ? "text-blue-300" : "text-slate-200"
                          }`}>
                            {session.title}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {relTime(session.createdAt)}
                            <span className="text-slate-700">·</span>
                            {session.messages.length - 1} msg{session.messages.length !== 2 ? "s" : ""}
                          </p>
                          {session.messages.length > 1 && (
                            <p className="text-xs text-slate-600 mt-0.5 truncate">
                              {session.messages[session.messages.length - 1].content.slice(0, 55)}…
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                            className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}