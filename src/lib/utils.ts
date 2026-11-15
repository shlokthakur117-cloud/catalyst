import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeSlot(time: string): string {
  if (time.toLowerCase() === "morning") return "Morning (8:00 AM)";
  if (time.toLowerCase() === "afternoon") return "Afternoon (1:00 PM)";
  if (time.toLowerCase() === "evening") return "Evening (6:00 PM)";
  if (time.toLowerCase() === "bedtime") return "Bedtime (9:00 PM)";
  return time;
}

export function formatDateHeading(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
