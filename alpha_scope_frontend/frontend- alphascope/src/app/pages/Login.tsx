import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/useAuth";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";
import {
  Mail, Lock, Eye, EyeOff, X, ArrowLeft,
  CheckCircle, BarChart2, Brain, TrendingUp, Linkedin,
} from "lucide-react";
import Logo from "../components/Logo";
import { usePageTitle } from "../hooks/usePageTitle";
import { BASE_URL } from "../lib/api";

const FEATURES = [
  {
    Icon: BarChart2,
    iconBg:    "bg-blue-500/20",
    iconColor: "text-blue-400",
    text: "Real-time market data & analytics",
  },
  {
    Icon: Brain,
    iconBg:    "bg-purple-500/20",
    iconColor: "text-purple-400",
    text: "AI-powered trading recommendations",
  },
  {
    Icon: TrendingUp,
    iconBg:    "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    text: "Paper trading for risk-free practice",
  },
];

export default function Login() {
  usePageTitle("Login");

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [showPwd,       setShowPwd]       = useState(false);
  const [isLoading,     setIsLoading]     = useState(false);
  const { login }     = useAuth();
  const navigate      = useNavigate();

  const [showForgot,    setShowForgot]    = useState(false);
  const [forgotEmail,   setForgotEmail]   = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent,    setForgotSent]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/");
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { toast.error("Please enter your email"); return; }
    setForgotLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/accounts/password/reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.detail || data.email?.[0] || "Failed to send reset email");
      } else {
        setForgotSent(true);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotEmail("");
    setForgotSent(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute top-10 left-10 sm:top-20 sm:left-20 w-48 h-48 sm:w-72 sm:h-72 bg-blue-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute bottom-10 right-10 sm:bottom-20 sm:right-20 w-64 h-64 sm:w-96 sm:h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-emerald-500/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
      </div>

      {/* Main content — grows to fill, pushes footer down */}
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center relative z-10 flex-1 py-8 lg:py-12">

        {/* ── LEFT — Branding ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden lg:flex flex-col text-white space-y-8"
        >
          <Logo size="lg" showText={true} />

          <div className="space-y-3">
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
              Smart Trading<br />Starts Here
            </h2>
            <p className="text-lg xl:text-xl text-slate-400 leading-relaxed">
              Your intelligent trading companion powered by AI and real-time analytics.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {FEATURES.map(({ Icon, iconBg, iconColor, text }, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.15, duration: 0.5 }}
                className="flex items-center gap-4"
              >
                <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <span className="text-slate-300 text-base">{text}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="flex items-center gap-8 pt-4 border-t border-slate-800"
          >
            {[
              { value: "3",    label: "AI Models"     },
              { value: "Live", label: "Market Data"   },
              { value: "Free", label: "Paper Trading" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── RIGHT — Login Form ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">

            {/* Mobile logo */}
            <div className="flex justify-center mb-6 lg:hidden">
              <Logo size="md" showText={true} />
            </div>

            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-slate-400 text-sm sm:text-base">Sign in to your AlphaScope account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="pl-9 sm:pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 h-11 sm:h-12 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-9 sm:pl-10 pr-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 h-11 sm:h-12 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors touch-manipulation"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none touch-manipulation">
                  <input type="checkbox"
                    className="rounded border-slate-700 bg-slate-800 accent-blue-500" />
                  <span className="text-xs sm:text-sm">Remember me</span>
                </label>
                <button type="button" onClick={() => setShowForgot(true)}
                  className="text-blue-400 hover:text-blue-300 transition-colors font-medium text-xs sm:text-sm touch-manipulation">
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 sm:h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm sm:text-base transition-all shadow-lg shadow-blue-500/20 touch-manipulation"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : "Sign In"}
              </Button>
            </form>

            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-slate-400 text-sm">
                Don't have an account?{" "}
                <Link to="/signup"
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  Sign up free
                </Link>
              </p>
            </div>

            <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-800">
              <p className="text-xs text-slate-600 text-center">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-6xl px-4 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">

          {/* Left: copyright + designer credit with LinkedIn */}
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 text-center sm:text-left">
            <p>© {new Date().getFullYear()} AlphaScope.</p>
            <span className="hidden sm:inline text-slate-700">·</span>
            <p>
              Designed &amp; Developed by{" "}
              <a
                href="https://www.linkedin.com/in/sharndeep-kaur-/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold transition-colors group"
              >
                Sharndeep Kaur
                <Linkedin className="w-3 h-3 opacity-70 group-hover:opacity-100 transition-opacity" />
              </a>
            </p>
          </div>

          {/* Right: contact email */}
          <a
            href="mailto:alphascope.team@gmail.com"
            className="flex items-center gap-1.5 hover:text-slate-400 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            alphascope.team@gmail.com
          </a>
        </div>
      </div>

      {/* ── Forgot Password Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && closeForgot()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              transition={{ duration: 0.2 }}
              className="w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 shadow-2xl relative"
            >
              {/* Mobile drag handle */}
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5 sm:hidden" />

              <button onClick={closeForgot}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors p-1 touch-manipulation">
                <X className="w-5 h-5" />
              </button>

              {!forgotSent ? (
                <>
                  <div className="mb-5 sm:mb-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Reset Password</h3>
                    <p className="text-slate-400 text-sm">
                      Enter your email and we'll send you a link to reset your password.
                    </p>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                        <Input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          className="pl-9 sm:pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 h-11 sm:h-12 text-sm sm:text-base"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full h-11 sm:h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold touch-manipulation"
                    >
                      {forgotLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                      ) : "Send Reset Link"}
                    </Button>
                    <button type="button" onClick={closeForgot}
                      className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors py-2 touch-manipulation">
                      <ArrowLeft className="w-4 h-4" /> Back to sign in
                    </button>
                  </form>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-4"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                    <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Check Your Email</h3>
                  <p className="text-slate-400 text-sm mb-1">We sent a reset link to</p>
                  <p className="text-blue-400 font-semibold mb-3 text-sm break-all">{forgotEmail}</p>
                  <p className="text-slate-500 text-xs mb-5">
                    Didn't receive it? Check your spam folder or try again.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setForgotSent(false); setForgotEmail(""); }}
                      className="flex-1 py-2.5 text-sm border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors touch-manipulation"
                    >
                      Try again
                    </button>
                    <button onClick={closeForgot}
                      className="flex-1 py-2.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors touch-manipulation">
                      Done
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster />
    </div>
  );
}