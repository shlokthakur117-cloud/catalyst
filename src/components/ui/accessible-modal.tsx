"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  showCloseButton?: boolean;
}

const MAX_WIDTH_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

/**
 * AccessibleModal provides a fully accessible dialog compliant with WAI-ARIA modal dialog patterns:
 * - Focus trapping within modal boundaries.
 * - Focus restoration to invoking element on close.
 * - Escape key closing behavior.
 * - Backdrop click dismissal.
 * - aria-modal="true", role="dialog", aria-labelledby, aria-describedby.
 */
export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
  showCloseButton = true,
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const titleId = "accessible-modal-title";
  const descId = "accessible-modal-description";

  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element for focus restoration
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // Focus the modal or its first focusable element
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    // Trap focus and handle Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Prevent body scroll while open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;

      // Restore focus to previously focused element
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="presentation"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative w-full ${MAX_WIDTH_CLASSES[maxWidth]} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-slate-200 dark:border-slate-800 p-6 sm:p-8 my-8 z-10 focus:outline-none`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2
              id={titleId}
              className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                className="mt-1 text-sm text-slate-600 dark:text-slate-400"
              >
                {description}
              </p>
            )}
          </div>

          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-2 -mr-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-slate-900"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
