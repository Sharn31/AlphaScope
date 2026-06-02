import { useState, useEffect } from "react";
import {
  User, Palette, Eye, EyeOff,
  Check, AlertTriangle, RefreshCw, Moon, Sun,
  Mail, Lock, Trash2, Shield, ChevronRight,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { changePassword, requestPasswordReset, updateEmail, deleteAccount } from "../lib/api";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";

type Tab = "account" | "appearance";

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: "", color: "", width: "0%" };
  if (pw.length < 6)  return { label: "Weak",   color: "bg-red-500",     width: "25%"  };
  if (pw.length < 10) return { label: "Fair",   color: "bg-amber-400",   width: "50%"  };
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw))
    return             { label: "Strong", color: "bg-emerald-500", width: "100%" };
  return               { label: "Good",   color: "bg-blue-500",    width: "75%"  };
}

export default function Settings() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("account");

  // ── Change Password ───────────────────────────────────────────────────────
  const [oldPassword,  setOldPassword]  = useState("");
  const [newPw,        setNewPw]        = useState("");
  const [confirmPw,    setConfirmPw]    = useState("");
  const [showOld,      setShowOld]      = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [pwLoading,    setPwLoading]    = useState(false);

  // ── Forgot Password ───────────────────────────────────────────────────────
  const [showForgot,    setShowForgot]    = useState(false);
  const [forgotEmail,   setForgotEmail]   = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent,    setForgotSent]    = useState(false);

  // ── Update Email ──────────────────────────────────────────────────────────
  const [newEmail,     setNewEmail]     = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // ── Delete Account ────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword,    setDeletePassword]    = useState("");
  const [deleteLoading,     setDeleteLoading]     = useState(false);

  // ── Appearance ────────────────────────────────────────────────────────────
  const [fontSize, setFontSize] = useState<"small" | "default" | "large">(
    () => (localStorage.getItem("fontSize") as "small" | "default" | "large") || "default"
  );
  const [compactLayout, setCompactLayout] = useState(
    () => localStorage.getItem("compactLayout") === "true"
  );

  useEffect(() => {
    const map = { small: "14px", default: "16px", large: "18px" };
    document.documentElement.style.fontSize = map[fontSize];
    localStorage.setItem("fontSize", fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.classList.toggle("compact", compactLayout);
    localStorage.setItem("compactLayout", String(compactLayout));
  }, [compactLayout]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPassword)          { toast.error("Enter your current password");           return; }
    if (newPw.length < 8)      { toast.error("New password must be at least 8 chars"); return; }
    if (newPw !== confirmPw)   { toast.error("New passwords do not match");            return; }

    setPwLoading(true);
    try {
      const data = await changePassword(oldPassword, newPw);
      // Backend returns 200 with { detail: "Old Password Incorrect" } on wrong pw
      if (data?.detail?.toLowerCase().includes("incorrect")) {
        toast.error("Current password is incorrect");
      } else {
        toast.success("Password changed successfully!");
        setOldPassword(""); setNewPw(""); setConfirmPw("");
      }
    } catch {
      toast.error("Current password is incorrect or network error");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await requestPasswordReset(forgotEmail.trim());
      setForgotSent(true);
    } catch {
      toast.error("Failed to send reset email. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleUpdateEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) { toast.error("Please enter a new email address"); return; }

    setEmailLoading(true);
    try {
      await updateEmail(newEmail.trim().toLowerCase());
      toast.success("Email updated successfully!");
      setNewEmail("");
    } catch {
      toast.error("Failed to update email. It may already be in use.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) { toast.error("Please enter your password to confirm"); return; }

    setDeleteLoading(true);
    try {
      await deleteAccount(deletePassword);
      localStorage.clear();
      window.location.href = "/login";
    } catch {
      toast.error("Incorrect password or failed to delete account.");
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Style tokens ──────────────────────────────────────────────────────────
  const bg       = isDarkMode ? "bg-[#0a0f1e]" : "bg-slate-50";
  const card     = isDarkMode
    ? "bg-[#0f172a] border border-white/[0.06]"
    : "bg-white border border-slate-200/80";
  const inputCls = isDarkMode
    ? "bg-slate-800/60 border border-white/10 text-white placeholder-slate-500 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40"
    : "bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30";
  const labelCls   = isDarkMode ? "text-slate-400" : "text-slate-500";
  const mutedCls   = isDarkMode ? "text-slate-500" : "text-slate-400";
  const headingCls = isDarkMode ? "text-slate-100" : "text-slate-800";
  const strength   = passwordStrength(newPw);

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "account",    label: "Account",    icon: User    },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-200`}>
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* ── Header ── */}
        <div className="mb-10">
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${isDarkMode ? "text-blue-400/70" : "text-blue-500/70"}`}>
            Configuration
          </p>
          <h1 className={`text-3xl font-bold tracking-tight ${headingCls}`}>Settings</h1>
          <p className={`text-sm mt-1.5 ${mutedCls}`}>
            Manage your account security and display preferences.
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div className={`inline-flex gap-1 p-1 rounded-xl mb-8 ${isDarkMode ? "bg-white/5" : "bg-slate-100"}`}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 py-2 px-5 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : isDarkMode
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ══ ACCOUNT TAB ══════════════════════════════════════════════════ */}
        {activeTab === "account" && (
          <div className="space-y-4">

            {/* ── Password card ── */}
            <div className={`rounded-2xl p-6 ${card}`}>
              <div className="flex items-start gap-3 mb-5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-blue-500/15" : "bg-blue-50"}`}>
                  <Lock className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <h2 className={`font-semibold text-sm ${headingCls}`}>
                    {showForgot ? "Reset Password" : "Change Password"}
                  </h2>
                  <p className={`text-xs mt-0.5 ${mutedCls}`}>
                    {showForgot
                      ? "We'll send a reset link to your email address."
                      : "Update your password by entering your current one first."}
                  </p>
                </div>
              </div>

              {/* ── Forgot password flow ── */}
              {showForgot ? (
                forgotSent ? (
                  <div className="text-center py-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDarkMode ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
                      <Check className="w-7 h-7 text-emerald-500" />
                    </div>
                    <p className={`font-semibold mb-1 ${headingCls}`}>Check your inbox</p>
                    <p className={`text-sm ${mutedCls}`}>
                      Reset link sent to{" "}
                      <span className="text-blue-400 font-medium">{forgotEmail}</span>
                    </p>
                    <p className={`text-xs mt-1 mb-6 ${mutedCls}`}>
                      Didn't receive it? Check your spam folder.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setForgotSent(false); setForgotEmail(""); }}
                        className={`flex-1 py-2.5 text-sm rounded-xl border transition-colors ${isDarkMode ? "border-white/10 hover:bg-white/5 text-slate-300" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}
                      >
                        Try again
                      </button>
                      <button
                        onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                        className="flex-1 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>
                        Email address
                      </label>
                      <div className="relative">
                        <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedCls}`} />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setShowForgot(false)}
                        className={`text-xs transition-colors ${isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        ← Back to change password
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
                      >
                        {forgotLoading ? "Sending…" : "Send reset link"}
                      </button>
                    </div>
                  </form>
                )
              ) : (
                /* ── Change password form ── */
                <form onSubmit={handleChangePassword} className="space-y-4">

                  {/* Old / current password */}
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>
                      Current password
                    </label>
                    <div className="relative">
                      <input
                        type={showOld ? "text" : "password"}
                        value={oldPassword}
                        onChange={e => setOldPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all pr-11 ${inputCls}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOld(v => !v)}
                        className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${mutedCls} hover:text-blue-400`}
                      >
                        {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>
                      New password
                    </label>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all pr-11 ${inputCls}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${mutedCls} hover:text-blue-400`}
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Strength meter */}
                    {newPw && (
                      <div className="mt-2.5 space-y-1">
                        <div className={`h-1 rounded-full overflow-hidden ${isDarkMode ? "bg-white/10" : "bg-slate-100"}`}>
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${strength.color}`}
                            style={{ width: strength.width }}
                          />
                        </div>
                        <p className={`text-xs ${mutedCls}`}>
                          Strength:{" "}
                          <span className={`font-medium ${
                            strength.label === "Strong" ? "text-emerald-400"
                            : strength.label === "Good" ? "text-blue-400"
                            : strength.label === "Fair" ? "text-amber-400"
                            : "text-red-400"
                          }`}>
                            {strength.label}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>
                      Confirm new password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        placeholder="Repeat new password"
                        required
                        className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all pr-11 ${inputCls}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${mutedCls} hover:text-blue-400`}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPw && (
                      <p className={`text-xs mt-1.5 flex items-center gap-1.5 ${newPw === confirmPw ? "text-emerald-400" : "text-red-400"}`}>
                        {newPw === confirmPw
                          ? <><Check className="w-3 h-3" /> Passwords match</>
                          : <><AlertTriangle className="w-3 h-3" /> Passwords do not match</>}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
                    >
                      {pwLoading ? "Saving…" : "Update password"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ── Update Email card ── */}
            <div className={`rounded-2xl p-6 ${card}`}>
              <div className="flex items-start gap-3 mb-5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-violet-500/15" : "bg-violet-50"}`}>
                  <Mail className="w-4 h-4 text-violet-500" />
                </div>
                <div>
                  <h2 className={`font-semibold text-sm ${headingCls}`}>Email Address</h2>
                  <p className={`text-xs mt-0.5 ${mutedCls}`}>
                    Update the email linked to your account.
                  </p>
                </div>
              </div>
              <form onSubmit={handleUpdateEmail} className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>
                    New email address
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedCls}`} />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="newemail@example.com"
                      required
                      className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
                  >
                    {emailLoading ? "Saving…" : "Update email"}
                  </button>
                </div>
              </form>
            </div>

            {/* ── Security notice ── */}
            <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${isDarkMode ? "bg-blue-500/5 border border-blue-500/10" : "bg-blue-50 border border-blue-100"}`}>
              <Shield className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <p className={`text-xs ${isDarkMode ? "text-blue-300/70" : "text-blue-600/70"}`}>
                Password changes will require you to log in again on other devices.
              </p>
            </div>

            {/* ── Danger Zone ── */}
            <div className={`rounded-2xl p-6 ${card}`}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/10">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-red-400">Danger Zone</h2>
                  <p className={`text-xs mt-0.5 ${mutedCls}`}>
                    Permanently delete your account and all associated data. This cannot be undone.
                  </p>
                </div>
              </div>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 text-sm text-red-400 border border-red-400/20 hover:bg-red-400/5 hover:border-red-400/40 px-4 py-2.5 rounded-xl transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete my account
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                </button>
              ) : (
                <div className={`rounded-xl p-4 border ${isDarkMode ? "bg-red-950/20 border-red-500/20" : "bg-red-50 border-red-100"}`}>
                  <p className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Confirm account deletion
                  </p>
                  <div className="mb-3">
                    <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>
                      Enter your password to confirm
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      placeholder="Your current password"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); }}
                      className={`flex-1 text-sm px-4 py-2.5 rounded-xl border transition-colors ${isDarkMode ? "border-white/10 hover:bg-white/5 text-slate-300" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="flex-1 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl transition-colors font-medium"
                    >
                      {deleteLoading ? "Deleting…" : "Yes, delete account"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ APPEARANCE TAB ═══════════════════════════════════════════════ */}
        {activeTab === "appearance" && (
          <div className="space-y-4">

            {/* Theme */}
            <div className={`rounded-2xl p-6 ${card}`}>
              <div className="flex items-start gap-3 mb-5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-amber-500/10" : "bg-amber-50"}`}>
                  {isDarkMode
                    ? <Moon className="w-4 h-4 text-amber-400" />
                    : <Sun  className="w-4 h-4 text-amber-500" />}
                </div>
                <div>
                  <h2 className={`font-semibold text-sm ${headingCls}`}>Theme</h2>
                  <p className={`text-xs mt-0.5 ${mutedCls}`}>
                    Currently using{" "}
                    <span className={`font-medium ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                      {isDarkMode ? "Dark" : "Light"}
                    </span>{" "}
                    mode.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "dark",  label: "Dark",  icon: Moon, desc: "Easier on the eyes"  },
                  { id: "light", label: "Light", icon: Sun,  desc: "Classic bright look"  },
                ].map(({ id, label, icon: Icon, desc }) => {
                  const active = id === "dark" ? isDarkMode : !isDarkMode;
                  return (
                    <button
                      key={id}
                      onClick={() => { if (!active) toggleTheme(); }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                        active
                          ? "border-blue-500 bg-blue-500/8"
                          : isDarkMode
                            ? "border-white/8 hover:border-white/15"
                            : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? "bg-blue-500/15" : isDarkMode ? "bg-white/5" : "bg-slate-100"}`}>
                        <Icon className={`w-4 h-4 ${active ? "text-blue-400" : mutedCls}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${active ? (isDarkMode ? "text-white" : "text-slate-800") : mutedCls}`}>
                          {label}
                        </p>
                        <p className={`text-xs ${mutedCls}`}>{desc}</p>
                      </div>
                      {active && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font size */}
            <div className={`rounded-2xl p-6 ${card}`}>
              <div className="flex items-start gap-3 mb-5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-slate-700" : "bg-slate-100"}`}>
                  <span className={`text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>Aa</span>
                </div>
                <div>
                  <h2 className={`font-semibold text-sm ${headingCls}`}>Font Size</h2>
                  <p className={`text-xs mt-0.5 ${mutedCls}`}>Adjusts the base font size across the app.</p>
                </div>
              </div>
              <div className="flex gap-2">
                {(["small", "default", "large"] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`flex-1 py-2.5 rounded-xl capitalize border text-sm transition-all font-medium ${
                      fontSize === size
                        ? "border-blue-500 text-blue-400 bg-blue-500/8"
                        : isDarkMode
                          ? "border-white/8 text-slate-400 hover:border-white/15"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {size === "small" ? "S" : size === "default" ? "M" : "L"}
                    <span className={`block text-xs font-normal mt-0.5 ${fontSize === size ? "text-blue-400/70" : mutedCls}`}>
                      {size}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Compact layout */}
            <div className={`rounded-2xl p-5 ${card}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-slate-700" : "bg-slate-100"}`}>
                    <RefreshCw className={`w-4 h-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                  </div>
                  <div>
                    <h2 className={`font-semibold text-sm ${headingCls}`}>Compact Layout</h2>
                    <p className={`text-xs mt-0.5 ${mutedCls}`}>Reduce spacing for more data on screen.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compactLayout}
                    onChange={() => setCompactLayout(v => !v)}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 rounded-full peer peer-checked:bg-blue-600
                    after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                    after:bg-white after:rounded-full after:h-5 after:w-5
                    after:transition-all peer-checked:after:translate-x-full
                    ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}
                  />
                </label>
              </div>
            </div>

          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}