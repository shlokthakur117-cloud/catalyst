"use client";

import React, { useState, useTransition } from "react";
import { Plus, X, Pill, Clock, Calendar, Check, AlertCircle } from "lucide-react";
import { createMedicationWithScheduleAction } from "@/app/actions/caregiver";
import { TimeOfDay } from "@/lib/validations/medication";

interface AddMedicationModalProps {
  elderId: string;
  elderName: string;
  onSuccess?: () => void;
}

const DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export function AddMedicationModal({ elderId, elderName, onSuccess }: AddMedicationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [instructions, setInstructions] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("morning");
  const [exactTime, setExactTime] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [doseAmount, setDoseAmount] = useState("1 pill");

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !strength.trim() || !instructions.trim()) {
      setError("Please fill in medication name, strength, and instructions.");
      return;
    }

    if (selectedDays.length === 0) {
      setError("Please select at least one day of the week.");
      return;
    }

    startTransition(async () => {
      const res = await createMedicationWithScheduleAction(elderId, {
        medication: {
          name: name.trim(),
          strength: strength.trim(),
          instructions: instructions.trim(),
          status: "active",
        },
        schedule: {
          time_of_day: timeOfDay,
          exact_time: exactTime ? exactTime : null,
          days_of_week: selectedDays,
          dose_amount: doseAmount.trim() || "1 pill",
        },
      });

      if (!res.success) {
        setError(res.error || "Failed to create medication");
      } else {
        setIsOpen(false);
        // Reset form
        setName("");
        setStrength("");
        setInstructions("");
        setExactTime("");
        setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
        if (onSuccess) onSuccess();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        <Plus className="w-5 h-5" />
        <span>Add Prescription</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <Pill className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Add Prescription</h2>
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
                  Medication Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lisinopril, Metformin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Strength *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10mg, 500mg"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Dose Amount
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 pill, 2 drops"
                    value={doseAmount}
                    onChange={(e) => setDoseAmount(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Instructions *
                </label>
                <textarea
                  placeholder="e.g. Take 1 tablet every morning with breakfast"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                  required
                />
              </div>

              {/* Schedule Configuration */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Daily Schedule</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Time Slot
                    </label>
                    <select
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="morning">Morning (08:00)</option>
                      <option value="afternoon">Afternoon (13:00)</option>
                      <option value="evening">Evening (18:00)</option>
                      <option value="bedtime">Bedtime (21:00)</option>
                      <option value="custom">Custom Time</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Exact Time (Optional)
                    </label>
                    <input
                      type="time"
                      value={exactTime}
                      onChange={(e) => setExactTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">
                    Days of the Week
                  </label>
                  <div className="flex gap-1.5 justify-between">
                    {DAYS.map((day) => {
                      const selected = selectedDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`w-10 h-10 rounded-xl text-xs font-bold flex items-center justify-center transition-all ${
                            selected
                              ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-400"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? "Saving..." : "Save Prescription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
