"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Pill,
  Calendar,
  Activity,
  ArrowRight,
  ExternalLink,
  Phone,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  fetchLinkedEldersAction,
  fetchCaregiverDashboardDataAction,
  claimAlertAction,
  resolveAlertAction,
  LinkedElderSummary,
  CaregiverDashboardData,
} from "@/app/actions/caregiver";
import { updateDoseStatusAction } from "@/app/actions/dose";
import {
  fetchAppointmentsAction,
  updateAppointmentStatusAction,
} from "@/app/actions/appointment";
import { fetchElderTimelineAction } from "@/app/actions/timeline";
import { AppointmentRecord } from "@/services/appointment-service";
import { TimelineItem } from "@/services/timeline-service";
import { AddMedicationModal } from "@/components/add-medication-modal";
import { AddAppointmentModal } from "@/components/add-appointment-modal";
import { ClaimInviteModal } from "@/components/claim-invite-modal";
import { AlertFeed } from "@/components/alert-feed";
import { SharedCareTimeline } from "@/components/shared-care-timeline";

export default function CaregiverDashboardPage() {
  const [elders, setElders] = useState<LinkedElderSummary[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string>("");
  const [dashboardData, setDashboardData] = useState<CaregiverDashboardData | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Load linked elders
  useEffect(() => {
    async function initElders() {
      setLoading(true);
      try {
        const linked = await fetchLinkedEldersAction();
        setElders(linked);
        if (linked.length > 0) {
          setSelectedElderId(linked[0].id);
        }
      } catch (err) {
        console.error("Failed to load linked elders:", err);
      } finally {
        setLoading(false);
      }
    }
    initElders();
  }, []);

  // Load dashboard data for selected elder
  const loadDashboard = async (elderId: string) => {
    if (!elderId) return;
    try {
      const [res, appts, tlRes] = await Promise.all([
        fetchCaregiverDashboardDataAction(elderId),
        fetchAppointmentsAction(elderId),
        fetchElderTimelineAction(elderId),
      ]);
      if (res.success && res.data) {
        setDashboardData(res.data);
      }
      if (appts.success && appts.data) {
        setAppointments(appts.data);
      }
      if (tlRes.success && tlRes.data) {
        setTimelineItems(tlRes.data);
      }
    } catch (err) {
      console.error("Failed to load caregiver data:", err);
    }
  };

  useEffect(() => {
    if (selectedElderId) {
      loadDashboard(selectedElderId);
    }
  }, [selectedElderId]);

  const handleClaimAlert = (alertId: string) => {
    setActionNotice("Claiming responsibility for alert...");
    startTransition(async () => {
      const res = await claimAlertAction(alertId);
      if (res.success) {
        setActionNotice("✓ You claimed this alert. Coordinate with elder.");
        loadDashboard(selectedElderId);
      } else {
        setActionNotice(`Failed to claim alert: ${res.error}`);
      }
      setTimeout(() => setActionNotice(null), 4000);
    });
  };

  const handleResolveAlert = (alertId: string, doseLogId?: string | null) => {
    const notes = prompt("Enter resolution notes (e.g., 'Phoned elder; confirmed morning Lisinopril was taken'):", "Confirmed dose ingestion over phone.");
    if (!notes) return;

    startTransition(async () => {
      const res = await resolveAlertAction(alertId, notes);
      if (res.success) {
        // Also update dose log to taken if associated
        if (doseLogId) {
          await updateDoseStatusAction(doseLogId, "taken", notes);
        }
        setActionNotice("✓ Alert marked resolved and recorded in audit log.");
        loadDashboard(selectedElderId);
      }
      setTimeout(() => setActionNotice(null), 4000);
    });
  };

  const handleCaregiverVerifyDose = (doseId: string, medName: string) => {
    const confirm = window.confirm(`Mark ${medName} as verified taken? This will be audited under your caregiver identity.`);
    if (!confirm) return;

    startTransition(async () => {
      const res = await updateDoseStatusAction(
        doseId,
        "taken",
        "Caregiver manually verified pill ingestion."
      );
      if (res.success) {
        setActionNotice(`✓ Recorded confirmed ingestion for ${medName}.`);
        loadDashboard(selectedElderId);
      }
      setTimeout(() => setActionNotice(null), 4000);
    });
  };

  if (loading && !dashboardData) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <RefreshCw className="w-12 h-12 animate-spin text-emerald-600 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-800">Loading Caregiver Command Center...</h1>
        </div>
      </main>
    );
  }

  const activeAlerts = dashboardData?.alerts || [];
  const doses = dashboardData?.doses || [];
  const stats = dashboardData?.stats;
  const currentElder = elders.find((e) => e.id === selectedElderId) || dashboardData?.elder;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-24 pt-6 px-4 md:px-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header & Multi-Elder Selector */}
        <header className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>CareLedger Command Center</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Collaborative Care Oversight
            </h1>
            <p className="text-base text-slate-500 font-medium">
              Deterministic medication tracking, active alert response, and multi-elder coordination.
            </p>
          </div>

          {/* Elder Selector Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <Users className="w-5 h-5 text-slate-600 ml-2" />
              <select
                value={selectedElderId}
                onChange={(e) => setSelectedElderId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-base focus:outline-none pr-4 cursor-pointer py-1.5"
                aria-label="Select active elder"
              >
                {elders.map((elder) => (
                  <option key={elder.id} value={elder.id}>
                    {elder.fullName} ({elder.relationshipType || "Linked"})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-200 transition-colors"
            >
              + Link Elder
            </button>

            <ClaimInviteModal
              isOpen={isInviteModalOpen}
              onClose={() => setIsInviteModalOpen(false)}
              onSuccess={async () => {
                const updated = await fetchLinkedEldersAction();
                setElders(updated);
              }}
            />

            <Link
              href="/elder"
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm border border-blue-200 transition-colors"
            >
              <span>Preview Elder View</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Global Action Banner */}
        {actionNotice && (
          <div
            className="p-4 rounded-2xl bg-slate-900 text-white font-bold text-base shadow-md flex items-center justify-between animate-in fade-in"
            role="status"
          >
            <span>{actionNotice}</span>
            <button
              onClick={() => setActionNotice(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Alerts Banner & Escalation Feed */}
        <AlertFeed
          alerts={activeAlerts}
          elderName={currentElder?.fullName}
          elderPhone={currentElder?.phone}
          onClaimAlert={handleClaimAlert}
          onResolveAlert={handleResolveAlert}
          isPending={isPending}
        />

        {/* 4-Card Adherence & Safety Metric Grid */}
        <section aria-label="Key Performance Indicators" className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Reported Adherence
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black text-slate-900">
                {stats?.adherenceRateDisplay ?? (stats?.adherenceRate !== null && stats?.adherenceRate !== undefined ? `${stats.adherenceRate}%` : "N/A")}
              </span>
              <span className="text-xs font-bold text-emerald-600">Today</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {stats?.adherenceRate === null
                ? "No closed dose windows today"
                : "Verified elder-confirmed ingestion only"}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Doses Taken
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black text-emerald-600">
                {stats?.takenDoses ?? 0}
              </span>
              <span className="text-base font-bold text-slate-400">/ {stats?.totalDoses ?? 0}</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Reported confirmed doses for today
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Unresolved Events
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl md:text-5xl font-black ${(stats?.unsureDoses || stats?.unconfirmedDoses) ? "text-rose-600" : "text-slate-900"}`}>
                {(stats?.unsureDoses ?? 0) + (stats?.unconfirmedDoses ?? 0)}
              </span>
              <span className="text-xs font-bold text-slate-500">Unsure / Overdue</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Events awaiting caregiver clarification
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Active Prescriptions
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black text-blue-600">
                {dashboardData?.medications.length ?? 0}
              </span>
              <span className="text-xs font-bold text-slate-500">Scheduled</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Currently managed medications
            </p>
          </div>
        </section>

        {/* Today's Dose Timeline */}
        <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Today&apos;s Medication Timeline</h2>
              <p className="text-sm text-slate-500">
                Real-time deterministic dose state tracking for {currentElder?.fullName}.
              </p>
            </div>
            <button
              onClick={() => loadDashboard(selectedElderId)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-bold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>

          {doses.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Pill className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-lg font-bold">No doses scheduled for today.</p>
              <p className="text-sm">Add a prescription to populate the schedule.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {doses.map((dose) => {
                const medName = dose.medications?.name || "Medication";
                const strength = dose.medications?.strength || "";
                const instructions = dose.medications?.instructions || "";
                const timeStr = new Date(dose.scheduled_for).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={dose.id}
                    className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 font-bold text-sm">
                        {timeStr}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-slate-900">{medName}</h3>
                          <span className="text-sm font-medium text-slate-500">({strength})</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{instructions}</p>
                        {dose.confirmed_at && (
                          <p className="text-xs text-slate-400 mt-1">
                            Confirmed: {new Date(dose.confirmed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      {/* Status Badges */}
                      {dose.status === "taken" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-sm font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Reported Taken</span>
                        </span>
                      )}
                      {dose.status === "not_yet" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-bold">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Snoozed (Not Yet)</span>
                        </span>
                      )}
                      {dose.status === "unsure" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 text-purple-800 text-sm font-bold">
                          <HelpCircle className="w-4 h-4 text-purple-600" />
                          <span>Patient Unsure</span>
                        </span>
                      )}
                      {dose.status === "unconfirmed" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-sm font-bold">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>Unconfirmed Overdue</span>
                        </span>
                      )}
                      {dose.status === "scheduled" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <span>Scheduled</span>
                        </span>
                      )}

                      {/* Caregiver Verification Override */}
                      {dose.status !== "taken" && (
                        <button
                          type="button"
                          onClick={() => handleCaregiverVerifyDose(dose.id, medName)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors"
                        >
                          Verify Ingestion
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Prescription Management Section */}
        <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Active Prescriptions</h2>
              <p className="text-sm text-slate-500">
                All medications and recurring schedules for {currentElder?.fullName}.
              </p>
            </div>
            {currentElder && (
              <AddMedicationModal
                elderId={selectedElderId}
                elderName={currentElder.fullName}
                onSuccess={() => loadDashboard(selectedElderId)}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboardData?.medications.map((med) => (
              <div
                key={med.id}
                className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{med.name}</h3>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {med.strength}
                  </span>
                </div>
                <p className="text-sm text-slate-600 font-medium">{med.instructions}</p>
                <div className="flex items-center gap-3 pt-2 text-xs text-slate-500">
                  <span>Status: <strong className="text-emerald-700 capitalize">{med.status}</strong></span>
                  {med.prescribing_doctor && (
                    <span>• Dr. {med.prescribing_doctor}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Appointments & Companion Notes Section */}
        <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Upcoming Medical Visits & Notes</h2>
              <p className="text-sm text-slate-500">
                Doctor visits, clinic locations, and companion instructions for {currentElder?.fullName}.
              </p>
            </div>
            {currentElder && (
              <AddAppointmentModal
                elderId={selectedElderId}
                elderName={currentElder.fullName}
                onSuccess={() => loadDashboard(selectedElderId)}
              />
            )}
          </div>

          {appointments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold">No upcoming medical visits scheduled.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{appt.title}</h3>
                      <p className="text-sm font-semibold text-purple-700">Dr. {appt.doctor_name}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                      appt.status === "upcoming" ? "bg-purple-100 text-purple-800" :
                      appt.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                    }`}>
                      {appt.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <p className="font-bold text-slate-800">
                      🗓️ {new Date(appt.scheduled_at).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })} at {new Date(appt.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                    {appt.clinic_address && <p>📍 {appt.clinic_address}</p>}
                  </div>

                  {appt.companion_notes && (
                    <div className="p-3 rounded-xl bg-purple-50 text-xs text-purple-900 font-medium">
                      💡 {appt.companion_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Shared Care Timeline & Immutable Audit Explorer */}
        <SharedCareTimeline
          items={timelineItems}
          elderName={currentElder?.fullName}
          loading={loading && timelineItems.length === 0}
        />
      </div>
    </main>
  );
}
