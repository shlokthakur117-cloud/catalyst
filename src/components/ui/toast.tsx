"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastProps {
  id?: string;
  type?: ToastType;
  title?: string;
  message: string;
  onDismiss?: () => void;
  autoDismissMs?: number;
}

const TOAST_CONFIGS = {
  success: {
    icon: CheckCircle2,
    containerClass:
      "bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 border-emerald-400 dark:border-emerald-600",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    role: "status",
    ariaLive: "polite" as const,
  },
  warning: {
    icon: AlertTriangle,
    containerClass:
      "bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 border-amber-400 dark:border-amber-600",
    iconClass: "text-amber-600 dark:text-amber-400",
    role: "status",
    ariaLive: "polite" as const,
  },
  error: {
    icon: AlertCircle,
    containerClass:
      "bg-rose-50 dark:bg-rose-950 text-rose-900 dark:text-rose-100 border-rose-400 dark:border-rose-600",
    iconClass: "text-rose-600 dark:text-rose-400",
    role: "alert",
    ariaLive: "assertive" as const,
  },
  info: {
    icon: Info,
    containerClass:
      "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700",
    iconClass: "text-slate-600 dark:text-slate-400",
    role: "status",
    ariaLive: "polite" as const,
  },
};

/**
 * Toast displays an accessible notification banner announcing dynamic state updates to screen readers.
 */
export function Toast({
  type = "info",
  title,
  message,
  onDismiss,
  autoDismissMs = 6000,
}: ToastProps) {
  const config = TOAST_CONFIGS[type] || TOAST_CONFIGS.info;
  const IconComponent = config.icon;

  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  return (
    <div
      role={config.role}
      aria-live={config.ariaLive}
      className={`flex items-start gap-3 p-4 rounded-xl border-2 shadow-lg transition-all ${config.containerClass}`}
    >
      <IconComponent
        className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconClass}`}
        aria-hidden="true"
      />
      <div className="flex-1">
        {title && <p className="font-bold text-sm tracking-tight">{title}</p>}
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="p-1 -mr-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
