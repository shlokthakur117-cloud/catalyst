"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type TextScale = "std" | "lg" | "xl";

interface AccessibilityContextType {
  textScale: TextScale;
  setTextScale: (scale: TextScale) => void;
  cycleTextScale: () => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  toggleHighContrast: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const STORAGE_KEY = "careledger_accessibility_prefs";

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [textScale, setTextScaleState] = useState<TextScale>("std");
  const [highContrast, setHighContrastState] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.textScale && ["std", "lg", "xl"].includes(parsed.textScale)) {
          setTextScaleState(parsed.textScale as TextScale);
        }
        if (typeof parsed.highContrast === "boolean") {
          setHighContrastState(parsed.highContrast);
        }
      }
    } catch {
      // Fallback to default
    }
    setIsHydrated(true);
  }, []);

  // Synchronize CSS classes on document.documentElement
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    // Apply text scale classes
    root.classList.remove("text-scale-std", "text-scale-lg", "text-scale-xl");
    root.classList.add(`text-scale-${textScale}`);

    // Apply high contrast class
    if (highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    // Persist preferences
    if (isHydrated) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ textScale, highContrast })
        );
      } catch {
        // Ignore storage write errors
      }
    }
  }, [textScale, highContrast, isHydrated]);

  const setTextScale = (scale: TextScale) => {
    setTextScaleState(scale);
  };

  const cycleTextScale = () => {
    setTextScaleState((prev) => {
      if (prev === "std") return "lg";
      if (prev === "lg") return "xl";
      return "std";
    });
  };

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled);
  };

  const toggleHighContrast = () => {
    setHighContrastState((prev) => !prev);
  };

  return (
    <AccessibilityContext.Provider
      value={{
        textScale,
        setTextScale,
        cycleTextScale,
        highContrast,
        setHighContrast,
        toggleHighContrast,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (!context) {
    // Provide a safe fallback if rendered outside provider
    return {
      textScale: "std",
      setTextScale: () => {},
      cycleTextScale: () => {},
      highContrast: false,
      setHighContrast: () => {},
      toggleHighContrast: () => {},
    };
  }
  return context;
}
