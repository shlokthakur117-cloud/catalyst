"use client";

import React from "react";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: {
    label: string;
    variant?: "success" | "warning" | "alert" | "neutral";
  };
  gaugePercentage?: number;
  className?: string;
}

const BADGE_VARIANTS = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-400/30",
  warning: "bg-amber-50 text-amber-800 border-amber-400/30",
  alert: "bg-rose-50 text-rose-800 border-rose-400/30",
  neutral: "bg-slate-100 text-slate-800 border-slate-300",
};

/**
 * StatCard displays clinical summary metrics with optional radial adherence gauge.
 */
export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  badge,
  gaugePercentage,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`relative bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {value}
            </span>
            {badge && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  BADGE_VARIANTS[badge.variant || "neutral"]
                }`}
              >
                {badge.label}
              </span>
            )}
          </div>
          {subtext && (
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 font-medium">
              {subtext}
            </p>
          )}
        </div>

        {/* Right side: Icon or Gauge */}
        {typeof gaugePercentage === "number" ? (
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <path
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Value stroke */}
              <path
                className={
                  gaugePercentage >= 80
                    ? "text-emerald-600"
                    : gaugePercentage >= 50
                    ? "text-amber-500"
                    : "text-rose-600"
                }
                strokeDasharray={`${Math.min(100, Math.max(0, gaugePercentage))}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-bold text-slate-800 dark:text-slate-200">
              {Math.round(gaugePercentage)}%
            </span>
          </div>
        ) : Icon ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Icon className="w-6 h-6" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
