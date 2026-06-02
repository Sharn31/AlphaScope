import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { BASE_URL } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

export default function ForgotPassword() {
  const { isDarkMode } = useTheme();
  const [email,     setEmail]     = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address"); return; }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${BASE_URL}/auth/password/reset/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      });

      // dj-rest-auth returns 200 even if email doesn't exist (security best practice)
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.email?.[0] ?? data?.detail ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const dark = isDarkMode;
  const bg   = dark ? "bg-slate-950" : "bg-slate-50";
  const card = dark ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-200 shadow-sm";
  const text = dark ? "text-white"      : "text-slate-900";
  const sub  = dark ? "text-slate-400"  : "text-slate-500";
  const inp  = dark
    ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
    : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500";

  // ── Success state ─────────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${bg}`}>
        <div className={`w-full max-w-md rounded-2xl p-8 text-center ${card}`}>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${text}`}>Check your email</h2>
          <p className={`text-sm mb-2 ${sub}`}>
            We sent a password reset link to
          </p>
          <p className="text-sm font-semibold text-blue-400 mb-6 break-all">{email}</p>
          <p className={`text-xs mb-8 ${sub}`}>
            Didn't receive it? Check your spam folder, or{" "}
            <button
              onClick={() => { setSent(false); setError(""); }}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              try again
            </button>
            .
          </p>
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${bg}`}>
      <div className={`w-full max-w-md rounded-2xl p-8 ${card}`}>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Mail className="w-7 h-7 text-blue-400" />
          </div>
        </div>

        <h1 className={`text-2xl font-bold text-center mb-2 ${text}`}>
          Forgot password?
        </h1>
        <p className={`text-sm text-center mb-8 ${sub}`}>
          Enter your email and we'll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dark ? "text-slate-300" : "text-slate-700"}`}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              className={`w-full px-3 py-2.5 rounded-lg text-sm border focus:outline-none
                focus:ring-2 focus:ring-blue-500/30 transition-colors ${inp}`}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
              text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className={`inline-flex items-center gap-1.5 text-sm transition-colors ${sub} hover:text-blue-400`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}