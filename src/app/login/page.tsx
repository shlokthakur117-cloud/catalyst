"use client";

import React, { useState, Suspense } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  HeartPulse,
  User,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
} from "lucide-react";
import { sanitizeRedirectUrl } from "@/lib/security";

function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams?.get("redirectTo") || null;
  const redirectTo = sanitizeRedirectUrl(rawRedirect);
  const initialError = searchParams?.get("error") === "auth_callback_failed"
    ? "Authentication session expired or invalid. Please sign in again."
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.success) {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.push("/");
        }
      } else {
        setError(result.error || "Invalid email or password.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string, demoPassword = "PasswordGate123!#") => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative">
      {/* Clinical Gradient Header Bar */}
      <div className="h-2 w-full bg-gradient-to-r from-clinical-primary via-clinical-primary-container to-clinical-secondary" />

      <div className="p-6 sm:p-8 flex flex-col">
        {/* Screen Heading */}
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-clinical-surface-container flex items-center justify-center mb-3 shadow-inner text-clinical-primary">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-clinical-text tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-clinical-muted">
            Your secure care circle, connected.
          </p>
        </div>

        {/* Accessible Error Alert Box */}
        {error && (
          <div
            aria-live="assertive"
            role="alert"
            className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="block font-semibold text-sm text-red-900">
                Credentials Not Recognized
              </span>
              <p className="mt-0.5 text-xs text-red-700 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Secure Sign In Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* Email Address */}
          <div>
            <label
              htmlFor="patient-email"
              className="block text-sm font-semibold text-clinical-text mb-1"
            >
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                id="patient-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Password with Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="patient-password"
                className="block text-sm font-semibold text-clinical-text"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-clinical-primary hover:text-clinical-primary-dark underline focus:outline-none"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                id="patient-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 flex justify-center items-center gap-2 rounded-xl text-base font-bold text-white bg-clinical-primary hover:bg-clinical-primary-dark focus:outline-none focus:ring-4 focus:ring-clinical-primary/30 disabled:opacity-60 transition-all shadow-md active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
            Evaluation Demo Quick-Fill
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickDemo("elder.a.gate@careledger.org")}
              className="py-2.5 px-3 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-xs font-semibold text-sky-900 flex items-center justify-center gap-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-sky-600" />
              <span>Elder Demo</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("caregiver.a.gate@careledger.org")}
              className="py-2.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-900 flex items-center justify-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Caregiver Demo</span>
            </button>
          </div>
        </div>

        {/* Registration Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-bold text-clinical-primary hover:text-clinical-primary-dark underline"
            >
              Create Elder or Caregiver Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-clinical-surface flex flex-col justify-between">
      {/* Top Navigation / Brand Header */}
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-4">
        <Suspense
          fallback={
            <div className="w-full max-w-md h-96 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-clinical-primary" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        CareLedger Care Coordination Network • Auditable Family & Elder Care
      </footer>
    </main>
  );
}
