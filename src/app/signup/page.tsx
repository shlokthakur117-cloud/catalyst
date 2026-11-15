"use client";

import React, { useState, useId } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
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
  Phone,
  CheckCircle2,
  XCircle,
  Shield,
  Pill,
  BellRing,
  Users,
  Check,
  Star,
} from "lucide-react";
import { UserRole } from "@/types/database";

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<UserRole>("elder");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Password validation rules
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Strength score
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
  const isFormValid = hasMinLength && passwordsMatch && consentChecked && fullName.trim().length > 0 && email.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!consentChecked) {
      setError("You must affirmatively agree to the Privacy Policy and health data sharing to proceed.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length > 128) {
      setError("Password cannot exceed 128 characters.");
      return;
    }

    if (!hasMinLength) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const result = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
        phone: phone.trim() || undefined,
      });

      if (result.success) {
        // Direct new user to guided onboarding
        router.push("/onboarding");
      } else {
        setError(result.error || "Registration failed. Please review your details.");
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
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
        <div className="h-16 w-full px-4 sm:px-6 max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-clinical-primary flex items-center justify-center text-white shadow-sm">
              <HeartPulse className="w-5 h-5" />
            </div>
            <span className="text-xl font-black text-clinical-text tracking-tight">
              Care<span className="text-clinical-primary">Ledger</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
              <Shield className="w-3.5 h-3.5 text-clinical-secondary" />
              <span>Secure Care Portal</span>
            </div>
            <Link
              href="/login"
              className="text-xs font-bold text-clinical-primary hover:text-clinical-primary-dark px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Brand Pillars & Assurance */}
          <div className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-clinical-surface-container rounded-full text-xs font-bold text-clinical-primary mb-3">
                <Users className="w-3.5 h-3.5" />
                <span>Family & Elder Trust Network</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-clinical-text tracking-tight leading-tight">
                Compassionate, auditable care coordination for families and elders.
              </h1>
              <p className="mt-2 text-sm text-clinical-muted leading-relaxed">
                Connect your care circle with deterministic dose verification, real-time safety alerts, and explicit access controls.
              </p>
            </div>

            {/* Core Value Pillars */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center shrink-0 text-sky-700">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Deterministic Medication Logs</h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    Auditable 7-state dose tracking. Only explicit elder confirmation marks a medication Taken.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 text-amber-700">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Instant Family Triage</h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    Caregiver alerts automatically trigger when doses are overdue or when elders flag uncertainty.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Strict Privacy & Sovereignty</h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    Database-level Row Level Security ensures only linked, authorized care circle members access medical records.
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonial Quote */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="text-xs italic text-slate-700 leading-relaxed">
                &ldquo;Managing Mom&apos;s daily medications used to be an anxious nightmare of group texts. CareLedger gave our entire family clarity and peace of mind within our first morning.&rdquo;
              </blockquote>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <div className="w-8 h-8 rounded-full bg-clinical-surface-container flex items-center justify-center text-xs font-bold text-clinical-primary">
                  EV
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Eleanor Vance-Kovacs</span>
                  <span className="text-slate-500">Family Caregiver</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Registration Form */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="h-2 w-full bg-gradient-to-r from-clinical-primary via-clinical-primary-container to-clinical-secondary" />

              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-extrabold text-clinical-text">
                    Create your account
                  </h2>
                  <p className="text-sm text-clinical-muted mt-1">
                    Select your primary role to configure your personalized dashboard.
                  </p>
                </div>

                {error && (
                  <div
                    aria-live="assertive"
                    role="alert"
                    className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-red-800 font-medium leading-relaxed">
                      {error}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  {/* Role Selection */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Account Role:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole("elder")}
                        className={`p-3.5 rounded-xl border-2 text-left flex flex-col justify-between transition-all ${
                          role === "elder"
                            ? "border-clinical-primary bg-sky-50 text-clinical-primary shadow-sm"
                            : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center mb-2">
                          <User className="w-4 h-4 text-sky-800" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">Elder / Patient</div>
                          <div className="text-xs text-slate-500 mt-0.5">Managing my medications</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRole("caregiver")}
                        className={`p-3.5 rounded-xl border-2 text-left flex flex-col justify-between transition-all ${
                          role === "caregiver"
                            ? "border-clinical-secondary bg-emerald-50 text-clinical-secondary shadow-sm"
                            : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-800" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">Family Caregiver</div>
                          <div className="text-xs text-slate-500 mt-0.5">Assisting elder care</div>
                        </div>
                      </button>
                    </div>

                    {/* Role Boundary Notice */}
                    <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-snug">
                      <span className="font-bold text-slate-800">Security Boundary: </span>
                      Account role customizes interface features. Caregiver accounts cannot view an elder&apos;s records without an authorized invitation code.
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="full-name"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="full-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Eleanor Vance"
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Email Address
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone (Optional) */}
                  <div>
                    <label
                      htmlFor="reg-phone"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Phone Number <span className="text-slate-400 font-normal">(Optional, for SMS alerts)</span>
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        id="reg-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Password with Strength Meter */}
                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        required
                        maxLength={128}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2.5 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Live Strength Meter */}
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

                  {/* Confirm Password */}
                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Confirm Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        maxLength={128}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((p) => !p)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        className="absolute right-2.5 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none"
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

                  {/* Affirmative Privacy & Data Sharing Consent (UNCHECKED BY DEFAULT) */}
                  <div className="pt-2">
                    <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/60 transition-colors">
                      <input
                        id="data-consent"
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-clinical-primary focus:ring-clinical-primary border-slate-300"
                        required
                      />
                      <span className="text-xs text-slate-700 leading-snug">
                        I affirmatively agree to the{" "}
                        <span className="font-semibold text-clinical-primary">Terms of Service</span> and{" "}
                        <span className="font-semibold text-clinical-primary">Privacy Policy</span>, and consent to secure health data sharing with authorized members of my care circle.
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !isFormValid}
                    className="w-full h-12 flex justify-center items-center gap-2 rounded-xl text-base font-bold text-white bg-clinical-primary hover:bg-clinical-primary-dark focus:outline-none focus:ring-4 focus:ring-clinical-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.99]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Registration</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Login Link */}
                <div className="mt-6 text-center pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    Already registered?{" "}
                    <Link
                      href="/login"
                      className="font-bold text-clinical-primary hover:text-clinical-primary-dark underline"
                    >
                      Sign in here
                    </Link>
                  </p>
                </div>
              </div>
            </div>
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
