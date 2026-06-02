import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { KeyRound, ArrowLeft, CheckCircle2, Loader2, Eye, EyeOff, XCircle } from "lucide-react";
import { BASE_URL } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

export default function ResetPassword() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const [newPassword1,    setNewPassword1]    = useState("");
  const [newPassword2,    setNewPassword2]    = useState("");
  const [showPassword1,   setShowPassword1]   = useState(false);
  const [showPassword2,   setShowPassword2]   = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [done,            setDone]            = useState(false);
  const [error,           setError]           = useState("");
  const [fieldErrors,     setFieldErrors]     = useState<Record<string, string>>({});

  // If uid or token is missing the link is broken
  const linkInvalid = !uid || !token;

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate("/login"), 3000);
      return () => clearTimeout(t);
    }
  }, [done, navigate]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (newPassword1.length < 8)
      errs.newPassword1 = "Password must be at least 8 characters";
    if (newPassword1 !== newPassword2)
      errs.newPassword2 = "Passwords do not match";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setIsLoading(true);
    try {
      // ✅ Custom backend — POST /auth/password/reset/confirm/
      // Expects exactly: { uid, token, new_password }
      const res = await fetch(`${BASE_URL}/accounts/password/reset/confirm/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          token,
          new_password: newPassword1,  // ✅ single field (not new_password1/2)
        }),
      });

      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json().catch(() => ({}));
        // Custom backend returns { detail: "..." } or { new_password: ["..."] }
        if (data?.new_password) {
          setFieldErrors({
            newPassword1: Array.isArray(data.new_password)
              ? data.new_password[0]
              : data.new_password,
          });
        } else {
          const msg = data?.detail ?? "Something went wrong. Please try again.";
          setError(msg);
        }
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const dark = isDarkMode;
  const bg   = dark ? "bg-slate-950" : "bg-slate-50";
  const card = dark ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-200 shadow-sm";
  const text = dark ? "text-white"     : "text-slate-900";
  const sub  = dark ? "text-slate-400" : "text-slate-500";
  const inp  = dark
    ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
    : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500";
  const label = dark ? "text-slate-300" : "text-slate-700";

  // ── Invalid link ──────────────────────────────────────────────────────────
  if (linkInvalid) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${bg}`}>
        <div className={`w-full max-w-md rounded-2xl p-8 text-center ${card}`}>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${text}`}>Invalid reset link</h2>
          <p className={`text-sm mb-8 ${sub}`}>
            This link is missing required parameters. Please request a new password reset.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
              bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            Request new link
          </Link>
          <div className="mt-4">
            <Link to="/login" className={`inline-flex items-center gap-1.5 text-sm transition-colors ${sub} hover:text-blue-400`}>
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${bg}`}>
        <div className={`w-full max-w-md rounded-2xl p-8 text-center ${card}`}>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${text}`}>Password reset!</h2>
          <p className={`text-sm mb-6 ${sub}`}>
            Your password has been updated successfully. Redirecting you to login…
          </p>
          {/* Progress bar */}
          <div className={`w-full h-1 rounded-full mb-6 overflow-hidden ${dark ? "bg-slate-800" : "bg-slate-100"}`}>
            <div className="h-full bg-blue-500 rounded-full animate-[shrink_3s_linear_forwards]" />
          </div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
              bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            Go to login now
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${bg}`}>
      <div className={`w-full max-w-md rounded-2xl p-8 ${card}`}>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-blue-400" />
          </div>
        </div>

        <h1 className={`text-2xl font-bold text-center mb-2 ${text}`}>
          Set new password
        </h1>
        <p className={`text-sm text-center mb-8 ${sub}`}>
          Choose a strong password — at least 8 characters.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* New password */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${label}`}>
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword1 ? "text" : "password"}
                value={newPassword1}
                onChange={(e) => { setNewPassword1(e.target.value); setFieldErrors((p) => ({ ...p, newPassword1: "" })); }}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                autoFocus
                className={`w-full px-3 py-2.5 pr-10 rounded-lg text-sm border focus:outline-none
                  focus:ring-2 focus:ring-blue-500/30 transition-colors ${inp}
                  ${fieldErrors.newPassword1 ? "border-red-500" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword1((v) => !v)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${sub} hover:text-blue-400 transition-colors`}
              >
                {showPassword1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.newPassword1 && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.newPassword1}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${label}`}>
              Confirm new password
            </label>
            <div className="relative">
              <input
                type={showPassword2 ? "text" : "password"}
                value={newPassword2}
                onChange={(e) => { setNewPassword2(e.target.value); setFieldErrors((p) => ({ ...p, newPassword2: "" })); }}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className={`w-full px-3 py-2.5 pr-10 rounded-lg text-sm border focus:outline-none
                  focus:ring-2 focus:ring-blue-500/30 transition-colors ${inp}
                  ${fieldErrors.newPassword2 ? "border-red-500" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword2((v) => !v)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${sub} hover:text-blue-400 transition-colors`}
              >
                {showPassword2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.newPassword2 && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.newPassword2}</p>
            )}
          </div>

          {/* Global error */}
          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}{" "}
              {(error.includes("expired") || error.includes("Invalid")) && (
                <Link to="/forgot-password" className="underline hover:text-red-300">
                  Request a new link
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
              text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Resetting…</>
            ) : (
              "Reset password"
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