"use client";

import React from "react";
import {
  AlertTriangle,
  Phone,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Pill,
  User,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { CaregiverAlertDetails } from "@/app/actions/caregiver";

interface AlertFeedProps {
  alerts: CaregiverAlertDetails[];
  elderName?: string;
  elderPhone?: string | null;
  onClaimAlert: (alertId: string) => void;
  onResolveAlert: (alertId: string, doseLogId?: string | null) => void;
  isPending?: boolean;
}

export function AlertFeed({
  alerts,
  elderName,
  elderPhone,
  onClaimAlert,
  onResolveAlert,
  isPending = false,
}: AlertFeedProps) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const openCount = alerts.filter((a) => a.status === "open").length;
  const claimedCount = alerts.filter((a) => a.status === "claimed").length;

  const formatTime = (isoString?: string) => {
    if (!isoString) return "Scheduled Window";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  return (
    <section
      aria-label="Caregiver Escalation & Urgency Feed"
      className="space-y-4 animate-in fade-in duration-300"
    >
      {/* Prominent High-Urgency Header Banner */}
      <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-700 text-white rounded-3xl p-5 md:p-6 shadow-md border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl relative">
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <AlertTriangle className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 font-extrabold text-xs tracking-wider uppercase">
                Action Required
              </span>
              <span className="text-rose-100 text-xs font-semibold">
                {openCount} Unclaimed • {claimedCount} In Progress
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white mt-0.5">
              Urgent Medication Escalation Feed
            </h2>
          </div>
        </div>

        {/* Global Dial Quick Action if elder phone exists */}
        {elderPhone && (
          <a
            href={`tel:${elderPhone}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-rose-700 font-bold text-sm shadow-sm transition-all transform active:scale-95"
            aria-label={`Call ${elderName || "Elder"} at ${elderPhone}`}
          >
            <Phone className="w-4 h-4 text-rose-600" />
            <span>Call Elder Now</span>
          </a>
        )}
      </div>

      {/* Grid of Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alerts.map((alert) => {
          const isClaimed = alert.status === "claimed";
          const isUnsure = alert.alert_type === "unsure_dose";
          const alertElderName = alert.elder_name || elderName || "Elder";
          const alertPhone = alert.elder_phone || elderPhone;
          const medName = alert.medication_name || "Prescribed Medication";
          const doseStatus = alert.dose_status || (isUnsure ? "unsure" : "unconfirmed");
          const scheduledTimeStr = formatTime(alert.scheduled_for);

          return (
            <div
              key={alert.id}
              data-testid={`alert-card-${alert.id}`}
              className={`p-6 rounded-3xl border-2 transition-all shadow-sm space-y-4 ${
                isClaimed
                  ? "bg-amber-50/70 border-amber-300"
                  : "bg-rose-50/90 border-rose-400"
              }`}
            >
              {/* Card Header: Type Badge & Urgency */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full font-extrabold text-xs uppercase tracking-wider ${
                        isUnsure
                          ? "bg-amber-200 text-amber-900 border border-amber-300"
                          : "bg-rose-200 text-rose-950 border border-rose-300"
                      }`}
                    >
                      {isUnsure ? "Unsure Dose Reported" : "Overdue Unconfirmed Dose"}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-xs uppercase ${
                        alert.urgency === "critical"
                          ? "bg-rose-600 text-white"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {alert.urgency || "High"} Priority
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 pt-1">
                    {medName}
                    {alert.dosage ? ` (${alert.dosage})` : ""}
                  </h3>
                </div>

                {/* Elder Avatar / Name */}
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Elder
                  </span>
                  <span className="text-sm font-black text-slate-800">
                    {alertElderName}
                  </span>
                </div>
              </div>

              {/* Dose & Clinical Context */}
              <div className="bg-white/90 rounded-2xl p-4 border border-slate-200 space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Scheduled Time:
                  </span>
                  <span className="font-bold text-slate-900">{scheduledTimeStr}</span>
                </div>

                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                    {isUnsure ? (
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    Dose State:
                  </span>
                  <span
                    className={`font-black uppercase text-xs px-2 py-0.5 rounded-md ${
                      doseStatus === "unsure"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {doseStatus}
                  </span>
                </div>

                {alert.resolution_notes && (
                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 italic">
                    Note: &quot;{alert.resolution_notes}&quot;
                  </div>
                )}
              </div>

              {/* Action Toolbar: Claim Status + Phone Quick Call + Resolve */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-rose-200/60">
                <div className="text-xs font-semibold">
                  {isClaimed ? (
                    <span className="text-emerald-800 font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Claimed by {alert.claimed_by_name || "You"}
                    </span>
                  ) : (
                    <span className="text-rose-800 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      Unclaimed — Immediate Response Needed
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Direct Phone Dial Button */}
                  {alertPhone && (
                    <a
                      href={`tel:${alertPhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-colors"
                      title={`Call ${alertElderName}`}
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      <span>Call</span>
                    </a>
                  )}

                  {/* Claim or Resolve Action */}
                  {!isClaimed ? (
                    <button
                      type="button"
                      onClick={() => onClaimAlert(alert.id)}
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                    >
                      Claim Responsibility
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alert.id, alert.dose_log_id)}
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
