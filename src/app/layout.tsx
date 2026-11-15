import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { AccessibilityProvider } from "@/contexts/accessibility-context";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "CareLedger — Medication & Care Coordination",
  description: "Deterministic medication tracking and collaborative care coordination for elders and caregivers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="text-scale-std">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-200">
        <AccessibilityProvider>
          <AuthProvider>
            <Navbar />
            {children}
          </AuthProvider>
        </AccessibilityProvider>
      </body>
    </html>
  );
}
