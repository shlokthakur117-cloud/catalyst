"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  HeartPulse,
  Shield,
  ShieldCheck,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  FileText,
  Lock,
  Calendar,
  LogIn,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getInviteSummaryAction, claimElderInviteAction } from "@/app/actions/auth";

interface InvitationViewProps {
  initialCode?: string;
}

export function InvitationView({ initialCode = "" }: InvitationViewProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [code, setCode] = useState(initialCode);
  const [loadingSummary, setLoadingSummary] = useState(Boolean(initialCode));
  const [summary, setSummary] = useState<{
    valid: boolean;
    status: "pending" | "expired" | "not_found";
    elderName?: string;
    relationshipType?: string;
    expiresAt?: string;
  } | null>(null);

  const [relationshipType, setRelationshipType] = useState("family");
  const [consentChecked, setConsentChecked] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    if (!initialCode) return;

    let mounted = true;
    setLoadingSummary(true);

    getInviteSummaryAction(initialCode)
      .then((res) => {
        if (mounted) {
          setSummary(res);
          if (res.relationshipType) {
            setRelationshipType(res.relationshipType);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setSummary({ valid: false, status: "not_found" });
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingSummary(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [initialCode]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoadingSummary(true);
    setClaimError(null);

    try {
      const res = await getInviteSummaryAction(code.trim());
      setSummary(res);
      if (res.relationshipType) {
        setRelationshipType(res.relationshipType);
      }
    } catch {
      setSummary({ valid: false, status: "not_found" });
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleClaim = async () => {
    if (!consentChecked) {
      setClaimError("You must affirmatively consent to join the care circle.");
      return;
    }

    setClaiming(true);
    setClaimError(null);

    try {
      const res = await claimElderInviteAction(code.trim(), relationshipType);
      if (res.success) {
        setClaimSuccess(true);
        setTimeout(() => {
          router.push("/caregiver");
        }, 1500);
      } else {
        setClaimError(res.error || "Failed to claim invitation.");
      }
    } catch (err: any) {
      setClaimError(err.message || "An unexpected error occurred.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Simulation / Verification Ribbon */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Care Circle Invitation • Cryptographically Verified</span>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Single-Use Enforced
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-clinical-primary via-clinical-primary-container to-clinical-secondary" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-clinical-text tracking-tight">
              You&apos;ve Been Invited to CareLedger
            </h1>
            <p className="mt-1 text-sm text-clinical-muted">
              Connect to an authorized care circle to coordinate medication schedules and support loved ones.
            </p>
          </div>

          {/* Code Search Input if no code or invalid */}
          {(!summary || !summary.valid) && (
            <div className="mb-6 p-5 bg-slate-50 rounded-xl border border-slate-200">
              <label
                htmlFor="invite-code-input"
                className="block text-sm font-bold text-slate-800 mb-1"
              >
                Care Circle Invitation Code
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Enter the 128-bit invitation code provided by the elder (format: CARE-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX).
              </p>
              <form onSubmit={handleLookup} className="flex gap-2">
                <input
                  id="invite-code-input"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CARE-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                  className="flex-1 h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 uppercase placeholder-slate-400 focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loadingSummary || !code.trim()}
                  className="h-11 px-5 rounded-xl bg-clinical-primary hover:bg-clinical-primary-dark text-white font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  {loadingSummary ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Verify Code</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Loading Indicator */}
          {loadingSummary && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-clinical-primary" />
              <span className="text-sm font-semibold text-slate-600">
                Verifying invitation token with database...
              </span>
            </div>
          )}

          {/* Error / Not Found / Expired States */}
          {!loadingSummary && summary && !summary.valid && (
            <div
              aria-live="assertive"
              role="alert"
              className="p-5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3.5 mb-6"
            >
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-red-900">
                  {summary.status === "expired"
                    ? "Invitation Expired"
                    : "Invalid or Already Claimed Invitation"}
                </h2>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  {summary.status === "expired"
                    ? `This invitation expired on ${new Date(summary.expiresAt || "").toLocaleString()}. For security, care circle invitations expire after 48 hours. Please request a fresh invitation code from ${summary.elderName || "the elder"}.`
                    : "We could not find an active pending invitation matching that token. It may have already been claimed or revoked."}
                </p>
              </div>
            </div>
          )}

          {/* Valid Invitation Showcase */}
          {!loadingSummary && summary && summary.valid && (
            <div className="space-y-6">
              {/* Inviter & Recipient Card */}
              <div className="p-5 bg-clinical-surface-container rounded-2xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-clinical-primary font-extrabold text-lg">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-clinical-primary block">
                        Care Recipient
                      </span>
                      <h2 className="text-xl font-bold text-slate-900">
                        {summary.elderName || "Elder"}
                      </h2>
                      <span className="text-xs text-slate-600">
                        Invited you to coordinate care and medication schedules
                      </span>
                    </div>
                  </div>

                  <div className="text-right sm:text-right">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-xs font-semibold text-slate-700 shadow-xs border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Expires: {summary.expiresAt ? new Date(summary.expiresAt).toLocaleDateString() : "48 hours"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explicit Access Governance Summary */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                <h2 className="text-sm font-bold text-slate-900 mb-2">
                  Explicit Access & Invariant Governance
                </h2>
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                  Joining this care circle grants access under strict clinical invariants:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>View real-time daily medication schedules</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Receive automated overdue and uncertainty alerts</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Log observational follow-up notes on timeline</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-700">
                    <Shield className="w-4 h-4 text-clinical-primary shrink-0 mt-0.5" />
                    <span className="font-semibold text-slate-900">
                      Elder-Only Taken: Caregivers cannot mark doses Taken
                    </span>
                  </div>
                </div>
              </div>

              {/* User Authentication Gate */}
              {!user ? (
                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-amber-950 mb-1">
                    Sign In to Accept This Invitation
                  </h2>
                  <p className="text-xs text-amber-800 max-w-md mx-auto mb-5 leading-relaxed">
                    To link your caregiver account with {summary.elderName || "the elder"}, please sign in or register a new caregiver account.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <Link
                      href={`/login?redirectTo=${encodeURIComponent(`/invite/${code.trim()}`)}`}
                      className="h-11 px-6 rounded-xl bg-clinical-primary hover:bg-clinical-primary-dark text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <span>Sign In as Caregiver</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/signup?role=caregiver&redirectTo=${encodeURIComponent(`/invite/${code.trim()}`)}`}
                      className="h-11 px-6 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center transition-colors"
                    >
                      <span>Create Caregiver Account</span>
                    </Link>
                  </div>
                </div>
              ) : claimSuccess ? (
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-emerald-950 mb-1">
                    Care Circle Connected!
                  </h2>
                  <p className="text-xs text-emerald-800">
                    You are now linked with {summary.elderName || "the elder"}. Redirecting to your Caregiver Dashboard...
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {claimError && (
                    <div
                      aria-live="assertive"
                      role="alert"
                      className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span className="text-xs text-red-800 font-medium">{claimError}</span>
                    </div>
                  )}

                  {/* Relationship Type Selector */}
                  <div>
                    <label
                      htmlFor="relationship-select"
                      className="block text-sm font-bold text-slate-900 mb-1"
                    >
                      Your Relationship to {summary.elderName || "Elder"}
                    </label>
                    <select
                      id="relationship-select"
                      value={relationshipType}
                      onChange={(e) => setRelationshipType(e.target.value)}
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none"
                    >
                      <option value="family">Family Caregiver</option>
                      <option value="daughter">Daughter / Son</option>
                      <option value="spouse">Spouse / Partner</option>
                      <option value="nurse">Nurse / Professional Caregiver</option>
                      <option value="other">Other Relative / Legal Guardian</option>
                    </select>
                  </div>

                  {/* Explicit Consent Checkbox (UNCHECKED BY DEFAULT) */}
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer select-none p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/60 transition-colors">
                      <input
                        id="claim-consent"
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-clinical-primary focus:ring-clinical-primary border-slate-300"
                      />
                      <span className="text-xs text-slate-700 leading-snug">
                        I affirmatively consent to join this care circle, agree to handle {summary.elderName || "the elder"}&apos;s medical data with strict confidentiality, and acknowledge that only the elder can confirm doses as Taken.
                      </span>
                    </label>
                  </div>

                  {/* Accept Button */}
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={claiming || !consentChecked}
                    className="w-full h-12 flex justify-center items-center gap-2 rounded-xl text-base font-bold text-white bg-clinical-primary hover:bg-clinical-primary-dark focus:outline-none focus:ring-4 focus:ring-clinical-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.99]"
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Activating Care Relationship...</span>
                      </>
                    ) : (
                      <>
                        <span>Accept & Connect Care Circle</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
