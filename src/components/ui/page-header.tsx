"use client";

import React from "react";
import { useAccessibility, TextScale } from "@/contexts/accessibility-context";
import { Type, Eye } from "lucide-react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  roleBadge?: string;
  children?: React.ReactNode; // Extra action buttons or widgets
  showAccessibilityControls?: boolean;
}

/**
 * PageHeader provides an authoritative, accessible heading zone with real text scaling
 * and WCAG AAA high-contrast toggles.
 * Never displays unverified compliance or encryption claims.
 */
export function PageHeader({
  title,
  subtitle,
  roleBadge,
  children,
  showAccessibilityControls = true,
}: PageHeaderProps) {
  const { textScale, setTextScale, highContrast, toggleHighContrast } = useAccessibility();

  const textScaleOptions: { id: TextScale; label: string; ariaLabel: string }[] = [
    { id: "std", label: "A", ariaLabel: "Standard text size" },
    { id: "lg", label: "A+", ariaLabel: "Large text size" },
    { id: "xl", label: "A++", ariaLabel: "Extra large text size" },
  ];

  return (
    <header className="mb-6 sm:mb-8 pb-6 border-b-2 border-slate-200 dark:border-slate-800">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Titles & Role Indicator */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            {roleBadge && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                {roleBadge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1.5 text-base sm:text-lg text-slate-600 dark:text-slate-400 font-medium max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right: Accessibility Controls & Action Slots */}
        <div className="flex flex-wrap items-center gap-3">
          {showAccessibilityControls && (
            <div
              role="group"
              aria-label="Display accessibility controls"
              className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm"
            >
              {/* Text Size Switcher */}
              <div className="flex items-center border-r border-slate-200 dark:border-slate-800 pr-1 mr-0.5">
                <span className="sr-only">Font size options</span>
                {textScaleOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTextScale(opt.id)}
                    aria-label={opt.ariaLabel}
                    aria-pressed={textScale === opt.id}
                    className={`px-2.5 py-1 text-xs sm:text-sm font-bold rounded-lg transition-colors ${
                      textScale === opt.id
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* High Contrast Toggle */}
              <button
                type="button"
                onClick={toggleHighContrast}
                aria-pressed={highContrast}
                aria-label={`Toggle high contrast mode. Currently ${
                  highContrast ? "enabled" : "disabled"
                }`}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-bold rounded-lg transition-colors ${
                  highContrast
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Contrast</span>
              </button>
            </div>
          )}

          {children}
        </div>
      </div>
    </header>
  );
}
