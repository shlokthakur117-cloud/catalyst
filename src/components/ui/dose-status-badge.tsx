"use client";

import React from "react";
import { DoseStatus } from "@/types/dose";
import {
  CheckCircle2,
  Clock,
  Bell,
  HelpCircle,
  AlertTriangle,
  XCircle,
  Hourglass,
} from "lucide-react";

export interface DoseStatusBadgeProps {
  status: DoseStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  customLabel?: string;
  className?: string;
}

interface StateStyleConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  containerClass: string;
  iconClass: string;
}

const STATUS_CONFIGS: Record<DoseStatus, StateStyleConfig> = {
  taken: {
    label: "Taken",
    icon: CheckCircle2,
    containerClass:
      "bg-emerald-50 text-emerald-800 border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600",
    iconClass: "text-emerald-700 dark:text-emerald-400",
  },
  scheduled: {
    label: "Scheduled",
    icon: Clock,
    containerClass:
      "bg-amber-50 text-amber-800 border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-600",
    iconClass: "text-amber-700 dark:text-amber-400",
  },
  reminded: {
    label: "Reminder Sent",
    icon: Bell,
    containerClass:
      "bg-amber-100/70 text-amber-900 border-amber-600/40 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-500",
    iconClass: "text-amber-800 dark:text-amber-300",
  },
  not_yet: {
    label: "Postponed",
    icon: Hourglass,
    containerClass:
      "bg-orange-50 text-orange-800 border-orange-500/40 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-600",
    iconClass: "text-orange-700 dark:text-orange-400",
  },
  unsure: {
    label: "I'm Unsure",
    icon: HelpCircle,
    containerClass:
      "bg-purple-50 text-purple-900 border-purple-500/40 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-600",
    iconClass: "text-purple-700 dark:text-purple-400",
  },
  unconfirmed: {
    label: "Unconfirmed",
    icon: AlertTriangle,
    containerClass:
      "bg-rose-50 text-rose-900 border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-600",
    iconClass: "text-rose-700 dark:text-rose-400",
  },
  skipped: {
    label: "Skipped",
    icon: XCircle,
    containerClass:
      "bg-slate-100 text-slate-800 border-slate-400/40 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
    iconClass: "text-slate-600 dark:text-slate-400",
  },
};

const SIZE_CLASSES = {
  sm: "text-xs px-2.5 py-0.5 gap-1 font-semibold",
  md: "text-sm px-3 py-1 gap-1.5 font-bold",
  lg: "text-base px-3.5 py-1.5 gap-2 font-bold",
};

const ICON_SIZES = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

/**
 * DoseStatusBadge represents strictly the 7 deterministic clinical dose states.
 * Guarantees WCAG AAA contrast and semantic pill geometry.
 */
export function DoseStatusBadge({
  status,
  size = "md",
  showIcon = true,
  customLabel,
  className = "",
}: DoseStatusBadgeProps) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.scheduled;
  const IconComponent = config.icon;
  const displayLabel = customLabel || config.label;

  return (
    <span
      role="status"
      aria-label={`Dose status: ${displayLabel}`}
      className={`inline-flex items-center rounded-full border shadow-sm transition-colors ${
        config.containerClass
      } ${SIZE_CLASSES[size]} ${className}`}
    >
      {showIcon && (
        <IconComponent
          className={`shrink-0 ${ICON_SIZES[size]} ${config.iconClass}`}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
