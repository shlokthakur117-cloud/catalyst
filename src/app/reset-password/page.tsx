"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  HeartPulse,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateUserPasswordAction } from "@/app/actions/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check auth session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setHasValidSession(true);
        } else {
          setHasValidSession(false);
        }
      } catch {
        setHasValidSession(false);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  // Password validation
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  let strengthScore = 0;
  if (hasMinLength) strengthScore++;
  if (hasNumber) strengthScore++;
  if (hasUppercase) strengthScore++;
  if (password.length >= 12) strengthScore++;

  const getStrengthLabel = () => {
    if (password.length === 0) return { label: "Required", color: "text-slate-400", width: "0%" };
    if (strengthScore <= 1) return { label: "Weak", color: "text-red-600", width: "25%" };
    if (strengthScore === 2) return { label: "Fair", color: "text-amber-600", width: "50%" };
    if (strengthScore === 3) return { label: "Good", color: "text-sky-600", width: "75%" };
    return { label: "Strong", color: "text-emerald-600", width: "100%" };
  };

  const strength = getStrengthLabel();
  const isFormValid = hasMinLength && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasMinLength) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await updateUserPasswordAction(password);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login?password_reset=success");
        }, 2000);
      } else {
        setError(res.error || "Failed to update password.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-clinical-surface flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="h-16 w-full px-4 sm:px-6 max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-clinical-primary flex items-center justify-center text-white shadow-sm">
              <HeartPulse className="w-5 h-5" />
            </div>
            <span className="text-xl font-black text-clinical-text tracking-tight">
              Care<span className="text-clinical-primary">Ledger</span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
            <Shield className="w-3.5 h-3.5 text-clinical-secondary" />
            <span>Secure Care Portal</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative">
          <div className="h-2 w-full bg-gradient-to-r from-clinical-primary via-clinical-primary-container to-clinical-secondary" />

          <div className="p-6 sm:p-8 flex flex-col items-center text-center">
            {checkingSession ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-clinical-primary" />
                <span className="text-sm font-semibold text-slate-600">
                  Verifying security credentials...
                </span>
              </div>
            ) : !hasValidSession ? (
              // Invalid or Expired Link
              <>
                <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mb-4 shadow-sm">
                  <AlertCircle className="w-8 h-8" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold mb-2">
                  <span>Expired or Invalid Link</span>
                </div>

                <h1 className="text-2xl font-extrabold text-clinical-text tracking-tight mb-2">
                  Reset link invalid
                </h1>

                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  This password reset link has expired or has already been used. Please request a fresh reset link to update your account password.
                </p>

                <div className="w-full flex flex-col gap-2.5">
                  <Link
                    href="/forgot-password"
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-clinical-primary text-xs font-bold text-white hover:bg-clinical-primary-dark transition-colors shadow-sm"
                  >
                    <span>Request New Reset Link</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href="/login"
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </Link>
                </div>
              </>
            ) : success ? (
              // Success Notice
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <h1 className="text-2xl font-extrabold text-clinical-text tracking-tight mb-2">
                  Password updated!
                </h1>

                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  Your new password has been safely updated. Redirecting you to sign in...
                </p>

                <Link
                  href="/login"
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-clinical-primary text-xs font-bold text-white hover:bg-clinical-primary-dark transition-colors shadow-sm"
                >
                  <span>Go to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              // Set New Password Form
              <>
                <div className="w-16 h-16 rounded-2xl bg-clinical-surface-container flex items-center justify-center mb-4 text-clinical-primary shadow-inner">
                  <KeyRound className="w-8 h-8" />
                </div>

                <h1 className="text-2xl font-extrabold text-clinical-text tracking-tight mb-1">
                  Set a new password
                </h1>
                <p className="text-sm text-clinical-muted mb-6 max-w-sm">
                  Choose a strong, unique password to protect your care circle records.
                </p>

                {error && (
                  <div
                    aria-live="assertive"
                    role="alert"
                    className="w-full mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-left"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="text-xs text-red-800 font-medium">{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 text-left" noValidate>
                  {/* New Password */}
                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      New Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                      <input
                        id="new-password"
                        name="new-password"
                        type={showPassword ? "text" : "password"}
                        required
                        maxLength={128}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2.5 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Live Strength Checklist */}
                    {password.length > 0 && (
                      <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-600 font-medium">Estimated Complexity (Advisory):</span>
                          <span className={`font-bold ${strength.color}`}>{strength.label}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              strengthScore <= 1
                                ? "bg-red-500"
                                : strengthScore === 2
                                ? "bg-amber-500"
                                : strengthScore === 3
                                ? "bg-sky-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: strength.width }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
                          <span className={`flex items-center gap-1 ${hasMinLength ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                            {hasMinLength ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                            8+ chars
                          </span>
                          <span className={`flex items-center gap-1 ${hasNumber ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                            {hasNumber ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                            1 number
                          </span>
                          <span className={`flex items-center gap-1 ${hasUppercase ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                            {hasUppercase ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                            1 uppercase
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                          Advisory estimate only; security is enforced by Supabase Auth encryption.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label
                      htmlFor="confirm-new-password"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Confirm New Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                      <input
                        id="confirm-new-password"
                        name="confirm-new-password"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        maxLength={128}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((p) => !p)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        className="absolute right-2.5 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg focus:outline-none"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {confirmPassword.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        {passwordsMatch ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Passwords match
                          </span>
                        ) : (
                          <span className="text-red-700 font-semibold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-red-600" /> Passwords do not match
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !isFormValid}
                    className="w-full h-12 mt-2 flex justify-center items-center gap-2 rounded-xl text-base font-bold text-white bg-clinical-primary hover:bg-clinical-primary-dark focus:outline-none focus:ring-4 focus:ring-clinical-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.99]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Updating password...</span>
                      </>
                    ) : (
                      <>
                        <span>Update Password & Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        CareLedger Care Coordination Network • Auditable Family & Elder Care
      </footer>
    </main>
  );
}
