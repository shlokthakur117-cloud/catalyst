import React, { Suspense } from "react";
import Link from "next/link";
import { HeartPulse, Shield, Loader2 } from "lucide-react";
import { InvitationView } from "@/components/auth/invitation-view";

interface PageProps {
  searchParams: Promise<{
    code?: string;
  }>;
}

export default async function GenericInvitePage({ searchParams }: PageProps) {
  const { code } = await searchParams;

  return (
    <main className="min-h-screen bg-clinical-surface flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="h-16 w-full px-4 sm:px-6 max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-clinical-primary flex items-center justify-center text-white shadow-sm">
              <HeartPulse className="w-5 h-5" />
            </div>
            <span className="text-xl font-black text-clinical-text tracking-tight">
              Care<span className="text-clinical-primary">Ledger</span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
            <Shield className="w-3.5 h-3.5 text-clinical-secondary" />
            <span>Secure Care Portal</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center items-center py-8">
        <Suspense
          fallback={
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-clinical-primary" />
            </div>
          }
        >
          <InvitationView initialCode={code || ""} />
        </Suspense>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        CareLedger Care Coordination Network • Auditable Family & Elder Care
      </footer>
    </main>
  );
}
