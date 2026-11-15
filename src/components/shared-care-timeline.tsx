"use client";

import React, { useState } from "react";
import {
  Clock,
  Pill,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  User,
  Users,
  ChevronDown,
  ChevronUp,
  FileText,
  Activity,
  History,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { TimelineItem, TimelineCategory } from "@/services/timeline-service";

interface SharedCareTimelineProps {
  items: TimelineItem[];
  elderName?: string;
  loading?: boolean;
}

export function SharedCareTimeline({
  items,
  elderName = "Elder",
  loading = false,
}: SharedCareTimelineProps) {
  const [activeCategory, setActiveCategory] = useState<TimelineCategory>("all");
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});

  const toggleDiff = (id: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredItems = items.filter((item) => {
    if (activeCategory === "all") return true;
    return item.category === activeCategory;
  });

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getEventIcon = (category: string) => {
    switch (category) {
      case "medication":
        return <Pill className="w-5 h-5 text-emerald-600" />;
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-rose-600" />;
      case "appointment":
        return <Calendar className="w-5 h-5 text-blue-600" />;
      default:
        return <Activity className="w-5 h-5 text-slate-600" />;
    }
  };

  const getActorBadge = (role: "elder" | "caregiver" | "system", name: string) => {
    switch (role) {
      case "elder":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <User className="w-3 h-3 text-emerald-600" />
            <span>Elder ({name})</span>
          </span>
        );
      case "caregiver":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
            <Users className="w-3 h-3 text-blue-600" />
            <span>Caregiver ({name})</span>
          </span>
        );
      case "system":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            <ShieldCheck className="w-3 h-3 text-slate-500" />
            <span>System Automation</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
        <Clock className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600 font-medium">Loading immutable care timeline...</p>
      </div>
    );
  }

  return (
    <section
      aria-label="Shared Care Timeline & Audit Log"
      className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6"
    >
      {/* Header & Category Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
            <History className="w-4 h-4 text-indigo-600" />
            <span>Shared Care Timeline & Audit Log</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Care Activity for {elderName}
          </h2>
          <p className="text-sm text-slate-500">
            Immutable, append-only record of all dose confirmations, alerts, appointments, and medication updates.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "All Activity" },
              { id: "medication", label: "Medications" },
              { id: "alert", label: "Alerts & Claims" },
              { id: "appointment", label: "Appointments" },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                activeCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Feed */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">No events found in this category.</p>
          <p className="text-xs text-slate-400 mt-1">
            Activity is recorded automatically when doses are confirmed or schedules change.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 md:pl-8 space-y-6 before:absolute before:left-2.5 md:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {filteredItems.map((item) => {
            const isDiffExpanded = !!expandedDiffs[item.id];
            const hasDiff =
              (item.oldValues && Object.keys(item.oldValues).length > 0) ||
              (item.newValues && Object.keys(item.newValues).length > 0);

            return (
              <div
                key={item.id}
                data-testid={`timeline-item-${item.id}`}
                className="relative group"
              >
                {/* Timeline Node Icon */}
                <div className="absolute -left-6 md:-left-8 top-1 p-1.5 rounded-full bg-white border-2 border-slate-300 shadow-xs group-hover:border-indigo-500 transition-colors">
                  {getEventIcon(item.category)}
                </div>

                {/* Event Card */}
                <div className="bg-slate-50 hover:bg-slate-100/80 rounded-2xl p-4 md:p-5 border border-slate-200 transition-all space-y-3">
                  {/* Card Header: Timestamp + Actor Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatTimestamp(item.timestamp)}
                      </span>
                      {getActorBadge(item.actorRole, item.actorName)}
                    </div>

                    <span className="text-xs font-mono text-slate-400">
                      {item.entityType}:{item.entityId.slice(0, 8)}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {item.description}
                    </p>
                  </div>

                  {/* Changed Fields Chips */}
                  {item.changedFields.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Changed:
                      </span>
                      {item.changedFields.map((field) => (
                        <span
                          key={field}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-xs font-semibold"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Audit Diff Toggle */}
                  {hasDiff && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => toggleDiff(item.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition-colors"
                      >
                        {isDiffExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Hide State Diff</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>Inspect Audit Diff (Before / After)</span>
                          </>
                        )}
                      </button>

                      {/* Expandable Before / After State Diff */}
                      {isDiffExpanded && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono bg-white p-3.5 rounded-xl border border-slate-200 shadow-inner">
                          {/* Before State */}
                          <div className="space-y-1">
                            <span className="text-rose-700 font-bold block uppercase tracking-wider text-[11px]">
                              ← Previous State
                            </span>
                            <pre className="p-2.5 rounded-lg bg-rose-50/50 text-rose-950 overflow-x-auto border border-rose-200 whitespace-pre-wrap break-all">
                              {item.oldValues
                                ? JSON.stringify(item.oldValues, null, 2)
                                : "null (Created)"}
                            </pre>
                          </div>

                          {/* After State */}
                          <div className="space-y-1">
                            <span className="text-emerald-700 font-bold block uppercase tracking-wider text-[11px]">
                              → New Verified State
                            </span>
                            <pre className="p-2.5 rounded-lg bg-emerald-50/50 text-emerald-950 overflow-x-auto border border-emerald-200 whitespace-pre-wrap break-all">
                              {item.newValues
                                ? JSON.stringify(item.newValues, null, 2)
                                : "null"}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
