"use client";

import React, { useState, useTransition } from "react";
import { Plus, X, Calendar, MapPin, User, FileText, AlertCircle } from "lucide-react";
import { createAppointmentAction } from "@/app/actions/appointment";

interface AddAppointmentModalProps {
  elderId: string;
  elderName: string;
  onSuccess?: () => void;
}

export function AddAppointmentModal({ elderId, elderName, onSuccess }: AddAppointmentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [companionNotes, setCompanionNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !doctorName.trim() || !scheduledAt) {
      setError("Please fill in appointment title, doctor name, and scheduled date/time.");
      return;
    }

    startTransition(async () => {
      const res = await createAppointmentAction({
        elder_id: elderId,
        title: title.trim(),
        doctor_name: doctorName.trim(),
        clinic_address: clinicAddress.trim() || null,
        scheduled_at: scheduledAt,
        companion_notes: companionNotes.trim() || null,
        status: "upcoming",
      });

      if (!res.success) {
        setError(res.error || "Failed to schedule appointment");
      } else {
        setIsOpen(false);
        setTitle("");
        setDoctorName("");
        setClinicAddress("");
        setScheduledAt("");
        setCompanionNotes("");
        if (onSuccess) onSuccess();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-purple-300"
      >
        <Plus className="w-4 h-4" />
        <span>Schedule Visit</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Schedule Medical Visit</h2>
                  <p className="text-sm text-slate-500">For {elderName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-sm font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Visit Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology Checkup, Dental Cleaning"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Doctor or Specialist Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Robert Chen"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Date and Time *
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Clinic or Hospital Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. St. Jude Medical Center, 4th Floor"
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Companion Notes / Instructions
                </label>
                <textarea
                  placeholder="e.g. Bring blood pressure log, fasting required from 8 PM"
                  value={companionNotes}
                  onChange={(e) => setCompanionNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? "Scheduling..." : "Save Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
