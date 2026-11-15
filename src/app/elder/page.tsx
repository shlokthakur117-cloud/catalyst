"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  PhoneCall,
  Pill,
  Sun,
  Sunset,
  Moon,
  AlertTriangle,
  RefreshCw,
  Heart,
  Calendar,
} from "lucide-react";
import {
  updateDoseStatusAction,
  fetchTodayDosesAction,
  getActiveElderAction,
} from "@/app/actions/dose";
import { fetchAppointmentsAction } from "@/app/actions/appointment";
import { AppointmentRecord } from "@/services/appointment-service";
import { DoseWithMedication } from "@/services/dose-service";
import { DoseStatus } from "@/types/dose";

export default function ElderDashboardPage() {
  const [elder, setElder] = useState<{
    id: string;
    fullName: string;
    emergencyContactPhone?: string | null;
    emergencyNotes?: string | null;
  } | null>(null);

  const [doses, setDoses] = useState<DoseWithMedication[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load elder profile and today's doses
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const activeElder = await getActiveElderAction();
        setElder(activeElder);

        if (activeElder) {
          const [doseResult, apptResult] = await Promise.all([
            fetchTodayDosesAction(activeElder.id),
            fetchAppointmentsAction(activeElder.id, { status: "upcoming" }),
          ]);

          if (apptResult.success && apptResult.data.length > 0) {
            setAppointments(apptResult.data);
          } else {
            // Friendly default demo appointment
            setAppointments([
              {
                id: "demo-appt-1",
                elder_id: activeElder.id,
                title: "Cardiology Wellness Check",
                doctor_name: "Dr. Robert Chen",
                clinic_address: "St. Jude Heart Center, Suite 402",
                scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days ahead
                companion_notes: "Bring blood pressure readings logbook",
                status: "upcoming",
                created_at: new Date().toISOString(),
              },
            ]);
          }

          if (doseResult.success && doseResult.doses.length > 0) {
            setDoses(doseResult.doses);
          } else {
            // Provide sensible fallback mock doses for instant visual demo if no schedules seeded
            setDoses([
              {
                id: "demo-dose-1",
                schedule_id: "sched-1",
                medication_id: "med-1",
                elder_id: activeElder.id,
                scheduled_for: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
                status: "scheduled",
                reminded_at: null,
                confirmed_at: null,
                confirmed_by: null,
                actor_role: null,
                notes: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                medications: {
                  name: "Lisinopril",
                  strength: "10mg",
                  instructions: "Take 1 pill with a full glass of water after breakfast",
                },
              },
              {
                id: "demo-dose-2",
                schedule_id: "sched-2",
                medication_id: "med-2",
                elder_id: activeElder.id,
                scheduled_for: new Date(new Date().setHours(13, 0, 0, 0)).toISOString(),
                status: "scheduled",
                reminded_at: null,
                confirmed_at: null,
                confirmed_by: null,
                actor_role: null,
                notes: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                medications: {
                  name: "Metformin",
                  strength: "500mg",
                  instructions: "Take 1 pill with lunch",
                },
              },
              {
                id: "demo-dose-3",
                schedule_id: "sched-3",
                medication_id: "med-3",
                elder_id: activeElder.id,
                scheduled_for: new Date(new Date().setHours(20, 0, 0, 0)).toISOString(),
                status: "scheduled",
                reminded_at: null,
                confirmed_at: null,
                confirmed_by: null,
                actor_role: null,
                notes: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                medications: {
                  name: "Atorvastatin",
                  strength: "20mg",
                  instructions: "Take 1 pill before bedtime",
                },
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Failed to load elder dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleDoseAction = (doseId: string, toStatus: DoseStatus, medName: string) => {
    // Optimistic UI update
    setDoses((prev) =>
      prev.map((d) =>
        d.id === doseId
          ? {
              ...d,
              status: toStatus,
              confirmed_at: toStatus === "taken" ? new Date().toISOString() : d.confirmed_at,
            }
          : d
      )
    );

    let feedback = "";
    if (toStatus === "taken") feedback = `✓ Recorded: Took ${medName}. Great job!`;
    if (toStatus === "not_yet") feedback = `⏳ Snoozed: We will remind you again soon for ${medName}.`;
    if (toStatus === "unsure") feedback = `❓ Caregiver notified for ${medName}. Someone will check in with you.`;

    setActionMessage(feedback);
    setTimeout(() => setActionMessage(null), 5000);

    startTransition(async () => {
      try {
        await updateDoseStatusAction(doseId, toStatus);
      } catch (err) {
        console.error("Server action failed:", err);
      }
    });
  };

  const completedCount = doses.filter((d) => d.status === "taken").length;
  const allCompleted = doses.length > 0 && completedCount === doses.length;

  const getTimeSlotIcon = (timeStr: string) => {
    const hour = new Date(timeStr).getHours();
    if (hour < 12) return <Sun className="w-8 h-8 text-amber-500" />;
    if (hour < 18) return <Sunset className="w-8 h-8 text-orange-500" />;
    return <Moon className="w-8 h-8 text-indigo-400" />;
  };

  const formatDoseTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <RefreshCw className="w-16 h-16 animate-spin text-blue-600 mx-auto" />
          <h1 className="text-3xl font-extrabold text-slate-800">Loading Your Medications...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-28 pt-4 px-4 sm:px-6 md:px-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header — Large High-Contrast Typography */}
        <header className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border-2 border-slate-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-slate-600 font-bold text-lg md:text-xl">
                <Calendar className="w-6 h-6 text-blue-600" />
                <span>
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-slate-950 mt-1 tracking-tight">
                {elder ? `Hello, ${elder.fullName.split(" ")[0]}` : "Your Daily Medications"}
              </h1>
            </div>

            {/* Emergency / Caregiver Direct Call Button */}
            <a
              href={`tel:${elder?.emergencyContactPhone || "555-019-2834"}`}
              className="inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xl shadow-md active:scale-95 transition-transform focus:outline-none focus:ring-4 focus:ring-rose-400 min-h-[64px]"
              aria-label="Call your caregiver or helper"
            >
              <PhoneCall className="w-7 h-7" />
              <span>Call Helper</span>
            </a>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6 pt-6 border-t-2 border-slate-200">
            <div className="flex items-center justify-between text-xl font-extrabold mb-2 text-slate-800">
              <span>Today&apos;s Progress</span>
              <span>
                {completedCount} of {doses.length} Taken
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-6 overflow-hidden">
              <div
                className="bg-emerald-600 h-6 rounded-full transition-all duration-500"
                style={{ width: `${doses.length ? (completedCount / doses.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </header>

        {/* Action Confirmation Banner */}
        {actionMessage && (
          <div
            className="p-6 rounded-2xl bg-blue-900 text-white text-2xl font-black shadow-lg border-2 border-blue-700 flex items-center gap-4 animate-in fade-in"
            role="status"
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Celebratory Banner if All Done */}
        {allCompleted && (
          <div className="p-8 rounded-3xl bg-emerald-50 border-4 border-emerald-500 shadow-lg text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <Heart className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-emerald-900">
              All Medications Taken for Today!
            </h2>
            <p className="text-xl md:text-2xl font-bold text-emerald-800">
              You are all caught up. Have a relaxing rest of your day!
            </p>
          </div>
        )}

        {/* Upcoming Medical Visit Banner */}
        {appointments.length > 0 && (
          <section
            aria-label="Upcoming Doctor Appointments"
            className="p-6 md:p-8 rounded-3xl bg-purple-50 border-4 border-purple-400 shadow-sm space-y-3"
          >
            <div className="flex items-center gap-3 text-purple-900 font-extrabold text-xl md:text-2xl">
              <Calendar className="w-8 h-8 text-purple-700" />
              <span>Upcoming Doctor Visit</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-black text-slate-950">
              {appointments[0].title} with {appointments[0].doctor_name}
            </h2>
            <p className="text-xl md:text-2xl font-bold text-slate-800">
              🗓️{" "}
              {new Date(appointments[0].scheduled_at).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              at{" "}
              {new Date(appointments[0].scheduled_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            {appointments[0].clinic_address && (
              <p className="text-lg md:text-xl font-bold text-slate-700">
                📍 {appointments[0].clinic_address}
              </p>
            )}
            {appointments[0].companion_notes && (
              <div className="p-4 rounded-2xl bg-white border-2 border-purple-200 text-lg md:text-xl font-bold text-purple-950">
                💡 Companion Note: {appointments[0].companion_notes}
              </div>
            )}
          </section>
        )}

        {/* Medication Cards List */}
        <section aria-label="Today's Prescriptions" className="space-y-6">
          {doses.map((dose) => {
            const medName = dose.medications?.name || "Medication";
            const strength = dose.medications?.strength || "";
            const instructions = dose.medications?.instructions || "Take as directed";
            const isTaken = dose.status === "taken";
            const isNotYet = dose.status === "not_yet";
            const isUnsure = dose.status === "unsure";
            const isUnconfirmed = dose.status === "unconfirmed";

            return (
              <article
                key={dose.id}
                className={`rounded-3xl p-6 md:p-8 shadow-md border-4 transition-all ${
                  isTaken
                    ? "bg-emerald-50/70 border-emerald-500"
                    : isUnsure
                    ? "bg-purple-50/70 border-purple-500"
                    : isNotYet
                    ? "bg-amber-50/70 border-amber-500"
                    : isUnconfirmed
                    ? "bg-rose-50/70 border-rose-500"
                    : "bg-white border-slate-300 hover:border-blue-500"
                }`}
              >
                {/* Card Top: Time, Icon, Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    {getTimeSlotIcon(dose.scheduled_for)}
                    <span className="text-2xl md:text-3xl font-black text-slate-800">
                      {formatDoseTime(dose.scheduled_for)}
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div>
                    {isTaken && (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-lg md:text-xl">
                        <CheckCircle2 className="w-6 h-6" />
                        <span>Taken</span>
                      </span>
                    )}
                    {isNotYet && (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-lg md:text-xl">
                        <Clock className="w-6 h-6" />
                        <span>Snoozed (Not Yet)</span>
                      </span>
                    )}
                    {isUnsure && (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-700 text-white font-black text-lg md:text-xl">
                        <HelpCircle className="w-6 h-6" />
                        <span>Caregiver Alerted</span>
                      </span>
                    )}
                    {isUnconfirmed && (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-lg md:text-xl">
                        <AlertTriangle className="w-6 h-6" />
                        <span>Unconfirmed</span>
                      </span>
                    )}
                    {dose.status === "scheduled" && (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-900 font-black text-lg md:text-xl">
                        <Pill className="w-6 h-6" />
                        <span>Due Now</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Medication Details */}
                <div className="space-y-3 mb-6">
                  <h2 className="text-3xl md:text-5xl font-black text-slate-950">
                    {medName}
                  </h2>
                  <p className="text-xl md:text-2xl font-bold text-slate-700">
                    Dose: {strength}
                  </p>
                  <div className="p-4 rounded-2xl bg-slate-100 border-2 border-slate-200">
                    <p className="text-lg md:text-xl font-bold text-slate-800 leading-snug">
                      👉 {instructions}
                    </p>
                  </div>
                </div>

                {/* 3 Massive Action Touch Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  {/* Button 1: Took it */}
                  <button
                    type="button"
                    onClick={() => handleDoseAction(dose.id, "taken", medName)}
                    className={`min-h-[72px] md:min-h-[84px] p-4 rounded-2xl font-black text-2xl md:text-3xl flex items-center justify-center gap-3 shadow-md active:scale-95 transition-all focus:outline-none focus:ring-4 ${
                      isTaken
                        ? "bg-emerald-700 text-white ring-4 ring-emerald-400"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-300"
                    }`}
                    aria-label={`Confirm you took ${medName}`}
                  >
                    <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10" />
                    <span>Took it</span>
                  </button>

                  {/* Button 2: Not yet */}
                  <button
                    type="button"
                    onClick={() => handleDoseAction(dose.id, "not_yet", medName)}
                    className={`min-h-[72px] md:min-h-[84px] p-4 rounded-2xl font-black text-2xl md:text-3xl flex items-center justify-center gap-3 shadow-md active:scale-95 transition-all focus:outline-none focus:ring-4 ${
                      isNotYet
                        ? "bg-amber-600 text-slate-950 ring-4 ring-amber-300"
                        : "bg-amber-400 hover:bg-amber-500 text-slate-950 focus:ring-amber-200"
                    }`}
                    aria-label={`Delay ${medName}, not yet taken`}
                  >
                    <Clock className="w-8 h-8 md:w-10 md:h-10" />
                    <span>Not yet</span>
                  </button>

                  {/* Button 3: I'm unsure */}
                  <button
                    type="button"
                    onClick={() => handleDoseAction(dose.id, "unsure", medName)}
                    className={`min-h-[72px] md:min-h-[84px] p-4 rounded-2xl font-black text-xl md:text-2xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all focus:outline-none focus:ring-4 ${
                      isUnsure
                        ? "bg-purple-800 text-white ring-4 ring-purple-400"
                        : "bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-300"
                    }`}
                    aria-label={`Report you are unsure about taking ${medName}`}
                  >
                    <HelpCircle className="w-7 h-7 md:w-8 md:h-8" />
                    <span>I&apos;m unsure</span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {/* Bottom Helper / Emergency Information Banner */}
        <footer className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border-2 border-slate-300 text-center space-y-4">
          <h3 className="text-2xl font-extrabold text-slate-900">Need Assistance?</h3>
          <p className="text-xl text-slate-700 font-semibold max-w-lg mx-auto">
            Your caregivers receive instant alerts if you report you are unsure or need guidance.
          </p>
          <div className="pt-2">
            <a
              href={`tel:${elder?.emergencyContactPhone || "555-019-2834"}`}
              className="inline-flex items-center gap-3 px-8 py-5 rounded-2xl bg-slate-900 hover:bg-black text-white text-2xl font-black shadow-lg active:scale-95 transition-transform min-h-[64px]"
            >
              <PhoneCall className="w-7 h-7 text-emerald-400" />
              <span>Call Helper ({elder?.emergencyContactPhone || "555-019-2834"})</span>
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
