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
  Phone,
  FileText,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Share2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { UserRole } from "@/types/database";
import {
  completeCareCircleOnboardingAction,
  createElderInviteAction,
  claimElderInviteAction,
} from "@/app/actions/auth";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, role: initialRole, loading: authLoading } = useAuth();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole>("elder");

  // Step 2: Emergency Contact
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyNotes, setEmergencyNotes] = useState("");

  // Step 3: Care Circle Link
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [caregiverInviteInput, setCaregiverInviteInput] = useState("");
  const [linkingInvite, setLinkingInvite] = useState(false);
  const [inviteLinkSuccess, setInviteLinkSuccess] = useState(false);
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);

  // Step 4: Consent
  const [consentChecked, setConsentChecked] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRole) {
      setSelectedRole(initialRole);
    }
  }, [initialRole]);

  const handleGenerateElderInvite = async () => {
    setGeneratingInvite(true);
    setSubmissionError(null);
    try {
      const res = await createElderInviteAction();
      if (res.success && "inviteCode" in res && res.inviteCode) {
        setGeneratedInviteCode(res.inviteCode);
      } else {
        setSubmissionError(res.error || "Failed to generate invite code.");
      }
    } catch (err: any) {
      setSubmissionError(err.message || "Failed to generate invite code.");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedInviteCode) return;
    try {
      await navigator.clipboard.writeText(generatedInviteCode);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleClaimCaregiverCode = async () => {
    if (!caregiverInviteInput.trim()) return;
    setLinkingInvite(true);
    setInviteLinkError(null);

    try {
      const res = await claimElderInviteAction(caregiverInviteInput.trim());
      if (res.success) {
        setInviteLinkSuccess(true);
      } else {
        setInviteLinkError(res.error || "Failed to link care circle.");
      }
    } catch (err: any) {
      setInviteLinkError(err.message || "An unexpected error occurred.");
    } finally {
      setLinkingInvite(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!consentChecked) {
      setSubmissionError("Affirmative privacy and data-sharing consent is required to finish setup.");
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    try {
      const res = await completeCareCircleOnboardingAction({
        emergencyContactPhone: emergencyPhone.trim() || undefined,
        emergencyNotes: emergencyNotes.trim() || undefined,
        consentedSharing: consentChecked,
      });

      if (res.success) {
        if (selectedRole === "caregiver") {
          router.push("/caregiver");
        } else {
          router.push("/elder");
        }
      } else {
        setSubmissionError(res.error || "Failed to finalize onboarding.");
      }
    } catch (err: any) {
      setSubmissionError(err.message || "An error occurred finalizing onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-clinical-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-clinical-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-clinical-surface flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
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
      <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-12 flex-1">
        {/* Stepper Progress Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-clinical-primary block">
                Guided Setup • Step {currentStep} of 4
              </span>
              <h1 className="text-lg font-bold text-slate-900">
                Care Circle & Account Configuration
              </h1>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {Math.round((currentStep / 4) * 100)}% Complete
            </span>
          </div>

          {/* Stepper Track */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { num: 1, label: "Role" },
              { num: 2, label: "Safety Contacts" },
              { num: 3, label: "Care Circle" },
              { num: 4, label: "Privacy Consent" },
            ].map((step) => {
              const isPast = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              return (
                <div
                  key={step.num}
                  className={`p-2 rounded-xl text-center border transition-all ${
                    isCurrent
                      ? "bg-clinical-primary text-white border-clinical-primary shadow-xs"
                      : isPast
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-slate-50 text-slate-400 border-slate-200"
                  }`}
                >
                  <div className="text-xs font-extrabold flex items-center justify-center gap-1">
                    {isPast ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <div className="text-[11px] truncate font-medium mt-0.5">
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Step Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-clinical-primary via-clinical-primary-container to-clinical-secondary" />

          <div className="p-6 sm:p-8">
            {submissionError && (
              <div
                aria-live="assertive"
                role="alert"
                className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <span className="text-xs text-red-800 font-medium leading-relaxed">
                  {submissionError}
                </span>
              </div>
            )}

            {/* STEP 1: ROLE CONFIRMATION */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Confirm your CareLedger role
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Choose the interface tailored to your daily needs. You can connect family members regardless of role.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setSelectedRole("elder")}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedRole === "elder"
                        ? "border-clinical-primary bg-sky-50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center mb-3 text-sky-800">
                      <User className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Elder / Patient</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      High-contrast, simplified daily dose view. Only you can confirm medications Taken.
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedRole("caregiver")}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedRole === "caregiver"
                        ? "border-clinical-secondary bg-emerald-50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3 text-emerald-800">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Family Caregiver</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Adherence analytics, overdue alert triage feed, and shared care timeline logging.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Access Governance: </span>
                  Caregiver accounts require an active, authorized invitation code from an elder to view medication schedules.
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="h-11 px-6 rounded-xl bg-clinical-primary hover:bg-clinical-primary-dark text-white font-bold text-xs flex items-center gap-2 shadow-sm"
                  >
                    <span>Next: Safety Contacts</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SAFETY CONTACTS */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Emergency & Care Circle Contacts
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Configure primary emergency contact numbers and clinical notes for unexpected triage.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="emergency-phone"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Primary Emergency Contact Phone
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        id="emergency-phone"
                        type="tel"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="+1 (555) 987-6543"
                        className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="emergency-notes"
                      className="block text-sm font-semibold text-clinical-text mb-1"
                    >
                      Emergency Care Notes <span className="text-slate-400 font-normal">(Allergies, physician contacts, medical notes)</span>
                    </label>
                    <textarea
                      id="emergency-notes"
                      rows={3}
                      value={emergencyNotes}
                      onChange={(e) => setEmergencyNotes(e.target.value)}
                      placeholder="e.g. Allergic to Penicillin. Primary physician: Dr. Reynolds (555-0192)."
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="h-11 px-5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="h-11 px-6 rounded-xl bg-clinical-primary hover:bg-clinical-primary-dark text-white font-bold text-xs flex items-center gap-2 shadow-sm"
                  >
                    <span>Next: Care Circle Linking</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CARE CIRCLE LINKING */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {selectedRole === "elder"
                      ? "Invite a Family Caregiver"
                      : "Connect to an Elder's Care Circle"}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {selectedRole === "elder"
                      ? "Generate a secure 128-bit invitation code to give to your caregiver. Invitations expire in 48 hours."
                      : "Enter an invitation code shared by the elder you are caring for, or skip to finish setup."}
                  </p>
                </div>

                {selectedRole === "elder" ? (
                  <div className="space-y-4">
                    {!generatedInviteCode ? (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
                        <KeyRound className="w-10 h-10 text-clinical-primary mx-auto" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Generate Secure Caregiver Code
                          </h3>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                            Creates a single-use, cryptographically salted 128-bit invitation token.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateElderInvite}
                          disabled={generatingInvite}
                          className="h-10 px-5 rounded-xl bg-clinical-primary hover:bg-clinical-primary-dark text-white font-bold text-xs inline-flex items-center gap-2 transition-colors"
                        >
                          {generatingInvite ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                          <span>Generate 48-Hour Invite Code</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900 uppercase">
                            Your Caregiver Invitation Code
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Expires in 48 Hours
                          </span>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-emerald-200 font-mono text-sm text-slate-900 break-all select-all">
                          <span className="flex-1 font-bold">{generatedInviteCode}</span>
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
                          >
                            {copiedInvite ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-emerald-800">
                          Share this code with your family member or nurse. They can claim it at{" "}
                          <span className="font-semibold underline">careledger.org/invite</span>.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {inviteLinkSuccess ? (
                      <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-emerald-900">
                            Care Circle Successfully Linked!
                          </h3>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            You are now authorized to view medication schedules and log care notes.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <label
                          htmlFor="cg-code-input"
                          className="block text-sm font-bold text-slate-900"
                        >
                          Elder Invitation Code (Optional)
                        </label>
                        {inviteLinkError && (
                          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                            {inviteLinkError}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            id="cg-code-input"
                            type="text"
                            value={caregiverInviteInput}
                            onChange={(e) => setCaregiverInviteInput(e.target.value)}
                            placeholder="CARE-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                            className="flex-1 h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-mono uppercase text-slate-900 placeholder-slate-400 focus:border-clinical-primary focus:ring-2 focus:ring-clinical-primary/20 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleClaimCaregiverCode}
                            disabled={linkingInvite || !caregiverInviteInput.trim()}
                            className="h-11 px-5 rounded-xl bg-clinical-primary hover:bg-clinical-primary-dark text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-60"
                          >
                            {linkingInvite ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <span>Claim Code</span>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          If you do not have an invitation code yet, you can link with an elder at any time from your dashboard.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="h-11 px-5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="h-11 px-6 rounded-xl bg-clinical-primary hover:bg-clinical-primary-dark text-white font-bold text-xs flex items-center gap-2 shadow-sm"
                  >
                    <span>Next: Privacy Consent</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: PRIVACY & DATA CONSENT */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Privacy, Sovereignty & Data Sharing Consent
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    CareLedger enforces strict clinical invariants and data security controls to protect your health records.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Deterministic Dose Safety: </strong>
                      Only explicit patient confirmation marks a dose Taken. Caregiver interactions are recorded as observational follow-ups.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Row Level Security: </strong>
                      Your data is isolated and accessible only to you and explicitly linked care circle members.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Application Audit Logs: </strong>
                      Every dose response, caregiver claim, and schedule change is logged with audited timestamps and database-enforced delete/update restrictions.
                    </span>
                  </div>
                </div>

                {/* Explicit Consent Checkbox (UNCHECKED BY DEFAULT) */}
                <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-200">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      id="onboarding-consent"
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-clinical-primary focus:ring-clinical-primary border-slate-300"
                    />
                    <span className="text-xs text-slate-800 font-medium leading-relaxed">
                      I affirmatively consent to CareLedger&apos;s Privacy Policy and agree to share medication schedules and care logs with authorized members of my care circle.
                    </span>
                  </label>
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="h-11 px-5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteOnboarding}
                    disabled={submitting || !consentChecked}
                    className="h-11 px-7 rounded-xl bg-clinical-primary hover:bg-clinical-primary-dark text-white font-bold text-sm flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Finalizing Setup...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Setup & Enter Portal</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
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
