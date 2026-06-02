import { useState, useEffect, useRef } from "react";
import { Send, Trash2, Bot, User, Sparkles, Clock, RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { useTheme } from "../context/ThemeContext";
import { authFetch, BASE_URL } from "../lib/api";
import { toast } from "sonner";
import { usePageTitle } from "../hooks/usePageTitle";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: string;
}

interface HistoryItem {
  id: number;
  message: string;
  reply: string;
  created_at: string;
}

const SUGGESTED_PROMPTS = [
  "What stocks should I watch today?",
  "Explain RSI indicator",
  "How is my portfolio performing?",
  "What is a stop-loss order?",
  "Latest market trends in India",
  "Best trading strategy for beginners",
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AIAssistant() {
  usePageTitle("AI Assistant");
  const { isDarkMode } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "bot",
      content: "Hello! I'm your AI trading assistant powered by Gemini. Ask me about stocks, trading strategies, market trends, or your portfolio. I'm here to help!",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await authFetch(`${BASE_URL}/market/chat/history/`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory(data.history ?? data ?? []);
    } catch {
      toast.error("Failed to load chat history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory) fetchHistory();
    setShowHistory(!showHistory);
  };

  const handleClearHistory = async () => {
    try {
      const res = await authFetch(`${BASE_URL}/market/chat/clear/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setHistory([]);
      setMessages([{
        id: "welcome",
        type: "bot",
        content: "Chat history cleared. How can I help you today?",
        timestamp: new Date().toISOString(),
      }]);
      toast.success("Chat history cleared");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const handleSend = async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: "user",
      content: msgText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await authFetch(`${BASE_URL}/market/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: data.reply ?? data.response ?? "Sorry, I couldn't process that.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: "Connection error. Please check your connection and try again.",
        timestamp: new Date().toISOString(),
      }]);
      toast.error("Failed to get response");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const bg = isDarkMode ? "bg-slate-950" : "bg-slate-50";
  const cardBg = isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const textPrimary = isDarkMode ? "text-white" : "text-slate-900";
  const textSecondary = isDarkMode ? "text-slate-400" : "text-slate-500";
  const inputBg = isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-300 text-slate-900";

  return (
    <div className="space-y-6 h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>AI Assistant</h1>
            <p className={`text-sm ${textSecondary}`}>Powered by AlphaScope · Trading Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleToggleHistory}
            variant="outline"
            size="sm"
            className={isDarkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : ""}
          >
            <Clock className="w-4 h-4 mr-1" />
            {showHistory ? "Hide History" : "View History"}
          </Button>
          <Button
            onClick={handleClearHistory}
            variant="outline"
            size="sm"
            className={`${isDarkMode ? "border-slate-700 text-red-400 hover:bg-slate-800" : "text-red-500 border-red-200 hover:bg-red-50"}`}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">

        {/* Chat Area */}
        <div className={`flex flex-col flex-1 rounded-2xl border ${cardBg} overflow-hidden`}>

          {/* Messages */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.type === "user" ? "flex-row-reverse" : "flex-row"}`}>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.type === "bot"
                      ? "bg-gradient-to-br from-blue-500 to-purple-600"
                      : isDarkMode ? "bg-slate-700" : "bg-slate-200"
                  }`}>
                    {msg.type === "bot"
                      ? <Bot className="w-4 h-4 text-white" />
                      : <User className={`w-4 h-4 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`} />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] space-y-1 ${msg.type === "user" ? "items-end" : "items-start"} flex flex-col`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.type === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : isDarkMode
                        ? "bg-slate-800 text-slate-100 rounded-tl-sm"
                        : "bg-slate-100 text-slate-900 rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>
                    <span className={`text-xs px-1 ${textSecondary}`}>
                      {timeAgo(msg.timestamp)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                    <div className="flex gap-1 items-center h-5">
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? "bg-slate-500" : "bg-slate-400"}`} style={{ animationDelay: "0ms" }} />
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? "bg-slate-500" : "bg-slate-400"}`} style={{ animationDelay: "150ms" }} />
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? "bg-slate-500" : "bg-slate-400"}`} style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Suggested Prompts */}
          {messages.length <= 1 && (
            <div className={`px-6 py-3 border-t ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
              <p className={`text-xs mb-2 ${textSecondary}`}>Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      isDarkMode
                        ? "border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-blue-500"
                        : "border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300"
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className={`p-4 border-t ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask about stocks, strategies, market trends..."
                className={`flex-1 h-11 ${inputBg}`}
                disabled={isLoading}
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="h-11 px-5 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </Button>
            </div>
          </div>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className={`w-80 rounded-2xl border flex flex-col ${cardBg} overflow-hidden`}>
            <div className={`p-4 border-b ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
              <h3 className={`font-semibold flex items-center gap-2 ${textPrimary}`}>
                <MessageSquare className="w-4 h-4 text-blue-400" />
                Chat History
              </h3>
              <p className={`text-xs mt-1 ${textSecondary}`}>{history.length} conversations</p>
            </div>
            <ScrollArea className="flex-1">
              {isLoadingHistory ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="p-6 text-center">
                  <MessageSquare className={`w-10 h-10 mx-auto mb-3 ${textSecondary}`} />
                  <p className={`text-sm ${textSecondary}`}>No history yet</p>
                </div>
              ) : (
                <div className="p-3 space-y-3">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMessages([
                          {
                            id: "welcome",
                            type: "bot",
                            content: "Hello! I'm your AI trading assistant powered by Gemini. Ask me about stocks, trading strategies, market trends, or your portfolio. I'm here to help!",
                            timestamp: new Date().toISOString(),
                          },
                          { id: `h-u-${item.id}`, type: "user", content: item.message, timestamp: item.created_at },
                          { id: `h-b-${item.id}`, type: "bot", content: item.reply, timestamp: item.created_at },
                        ]);
                        setShowHistory(false);
                      }}
                      className={`w-full text-left rounded-xl p-3 border transition-all ${
                        isDarkMode
                          ? "border-slate-800 hover:border-blue-500 hover:bg-slate-800"
                          : "border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                    >
                      <p className={`text-xs font-medium truncate ${textPrimary}`}>{item.message}</p>
                      <p className={`text-xs truncate mt-1 ${textSecondary}`}>{item.reply}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <Clock className={`w-3 h-3 ${textSecondary}`} />
                        <span className={`text-xs ${textSecondary}`}>{timeAgo(item.created_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}