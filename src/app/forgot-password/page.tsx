"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  HeartPulse,
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Shield,
  Info,
} from "lucide-react";
import { requestPasswordResetAction } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await requestPasswordResetAction(email);
      setFeedbackMessage(res.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Unable to dispatch password reset. Please try again.");
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
            {!submitted ? (
              <>
                {/* Visual Icon */}
                <div className="w-16 h-16 rounded-2xl bg-clinical-surface-container flex items-center justify-center mb-4 text-clinical-primary shadow-inner">
                  <KeyRound className="w-8 h-8" />
                </div>

                <h1 className="text-2xl font-extrabold text-clinical-text tracking-tight mb-1">
                  Forgot your password?
                </h1>
                <p className="text-sm text-clinical-muted mb-6 max-w-sm">
                  Enter your registered account email and we&apos;ll send you instructions to reset your password.
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 text-left" noValidate>
                  <div>
                    <label
                      htmlFor="recovery-email"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Email Address
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                      <input
                        id="recovery-email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full h-12 mt-1 flex justify-center items-center gap-2 rounded-xl text-base font-bold text-white bg-clinical-primary hover:bg-clinical-primary-dark focus:outline-none focus:ring-4 focus:ring-clinical-primary/30 disabled:opacity-60 transition-all shadow-md active:scale-[0.99]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Sending reset link...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 w-full border-t border-slate-200 flex items-center justify-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-xs font-bold text-clinical-primary hover:text-clinical-primary-dark transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </Link>
                </div>
              </>
            ) : (
              <>
                {/* State B: Email Sent Notice */}
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
                  <span>Instructions Dispatched</span>
                </div>

                <h1 className="text-2xl font-extrabold text-clinical-text tracking-tight mb-2">
                  Check your inbox
                </h1>

                <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-sm">
                  {feedbackMessage}
                </p>

                {/* Guidance Card */}
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left flex items-start gap-2.5 mb-6">
                  <Info className="w-4 h-4 text-clinical-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 leading-snug">
                    <span className="font-semibold text-slate-800 block mb-0.5">
                      Didn&apos;t receive the email?
                    </span>
                    Please check your spam or junk folder, or verify that you entered your registered address.
                  </div>
                </div>

                <div className="w-full flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setEmail("");
                    }}
                    className="w-full h-11 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Send to a different email address
                  </button>

                  <Link
                    href="/login"
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-clinical-primary text-xs font-bold text-white hover:bg-clinical-primary-dark transition-colors shadow-sm"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </Link>
                </div>
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
