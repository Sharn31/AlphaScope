import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/useAuth";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";
import { Mail, Lock, User, Eye, EyeOff, TrendingUp, ExternalLink } from "lucide-react";
import Logo from "../components/Logo";
import { usePageTitle } from "../hooks/usePageTitle";

const FEATURES = [
  {
    delay: 0.3,
    gradient: "from-blue-500 to-blue-600",
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Advanced Analytics",
    desc: "Track your portfolio with real-time charts and technical indicators",
  },
  {
    delay: 0.5,
    gradient: "from-purple-500 to-purple-600",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "AI Recommendations",
    desc: "Get intelligent buy/sell signals powered by machine learning",
  },
  {
    delay: 0.7,
    gradient: "from-emerald-500 to-emerald-600",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "100% Secure",
    desc: "Bank-level encryption to keep your data safe and private",
  },
];

export default function Signup() {
  usePageTitle("Sign Up");

  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const { signup } = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      toast.error("Please fill in all fields"); return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match"); return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters"); return;
    }
    setIsLoading(true);
    try {
      await signup(name, email, password);
      toast.success("Account created successfully!");
      navigate("/");
    } catch {
      toast.error("Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">

      {/* Animated blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-10 right-10 sm:top-20 sm:right-20 w-48 sm:w-72 h-48 sm:h-72 bg-purple-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-10 left-10 sm:bottom-20 sm:left-20 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{ scale: [1.3, 1, 1.3], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Main card area */}
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6 lg:gap-10 items-center relative z-10 pb-16 sm:pb-20">

        {/* ── Sign-up Form ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full max-w-md mx-auto lg:order-2"
        >
          {/* Mobile logo */}
          <div className="flex justify-center mb-6 lg:hidden">
            <Logo size="md" showText={true} />
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1.5">Create Account</h2>
              <p className="text-slate-400 text-sm sm:text-base">Start your trading journey today</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-slate-300 text-sm">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                  <Input
                    id="name" type="text" value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="pl-9 sm:pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11 sm:h-12 text-sm"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                  <Input
                    id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9 sm:pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11 sm:h-12 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 sm:pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11 sm:h-12 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-slate-300 text-sm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 sm:pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11 sm:h-12 text-sm"
                  />
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-800 accent-blue-500 flex-shrink-0"
                />
                <label className="text-slate-400 leading-relaxed">
                  I agree to the{" "}
                  <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</a>
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 sm:h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold text-sm sm:text-base transition-all"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : "Create Account"}
              </Button>
            </form>

            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-slate-400 text-sm">
                Already have an account?{" "}
                <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Features Panel (desktop only) ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="hidden lg:flex flex-col text-white space-y-6 lg:order-1"
        >
          <div className="mb-2">
            <Logo size="lg" showText={true} />
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight">
            Join Thousands<br />of Smart Traders
          </h2>
          <p className="text-lg xl:text-xl text-slate-300">
            Experience the future of trading with advanced analytics and AI-powered insights
          </p>

          <div className="space-y-3 pt-4">
            {FEATURES.map(({ delay, gradient, icon, title, desc }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay, duration: 0.5 }}
                className="flex items-start gap-4 bg-slate-800/30 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50"
              >
                <div className={`w-11 h-11 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  {icon}
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-1">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 py-4 sm:py-5 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
            <p className="text-slate-500 text-center sm:text-left">
              © {new Date().getFullYear()} AlphaScope. Developed by{" "}
              <a
                href="https://www.linkedin.com/in/sharndeep-kaur-/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1 transition-colors"
              >
                Sharndeep Kaur
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <a
              href="mailto:alphascope.team@gmail.com"
              className="flex items-center gap-1.5 text-slate-400 hover:text-blue-400 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>alphascope.team@gmail.com</span>
            </a>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}