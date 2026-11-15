"use client";

import React from "react";

export interface LoadingSkeletonProps {
  className?: string;
}

/**
 * Base accessible pulsing skeleton block.
 */
export function SkeletonBlock({ className = "" }: LoadingSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`}
    />
  );
}

/**
 * SkeletonCard simulates loading for medication cards or summary panels.
 */
export function SkeletonCard({ className = "" }: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading content..."
      className={`bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-6 w-32 rounded-full" />
        <SkeletonBlock className="h-5 w-20 rounded-full" />
      </div>
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-full" />
      <div className="pt-2 flex gap-3">
        <SkeletonBlock className="h-12 w-32 rounded-xl" />
        <SkeletonBlock className="h-12 w-32 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * SkeletonStatGrid simulates loading for top-level metrics.
 */
export function SkeletonStatGrid({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading statistics..."
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-6 space-y-3"
        >
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-10 w-28" />
          <SkeletonBlock className="h-4 w-36" />
        </div>
      ))}
    </div>
  );
}
