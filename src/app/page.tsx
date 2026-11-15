import Link from "next/link";
import { HeartPulse, ShieldCheck, UserCheck, Bell, Activity, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 md:p-12">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-base font-semibold">
          <HeartPulse className="w-5 h-5 text-blue-700" />
          <span>CareLedger — Collaborative Care Coordination</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
          Reported Confirmations for Elders, Actionable Visibility for Caregivers
        </h1>

        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Reminders are never assumed as ingestion. Real-time deterministic logging of reported confirmations, high-contrast touch interfaces, and automatic caregiver escalation for unresolved medication events.
        </p>

        {/* Dual Role Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 text-left">
          {/* Elder Mode Card */}
          <Link
            href="/elder"
            className="group block p-8 rounded-2xl bg-white border-2 border-blue-500 shadow-lg hover:shadow-xl hover:border-blue-600 transition-all focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <UserCheck className="w-8 h-8 text-blue-700" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Elder Mode</h2>
            <p className="text-base text-slate-600 mb-6">
              Large touch buttons, clear daily schedules, and single-touch dose confirmation: &quot;I took this&quot;, &quot;Not yet&quot;, or &quot;I&apos;m unsure&quot;.
            </p>
            <span className="inline-flex items-center text-lg font-bold text-blue-700 group-hover:translate-x-1 transition-transform">
              Open Elder View &rarr;
            </span>
          </Link>

          {/* Caregiver Command Center Card */}
          <Link
            href="/caregiver"
            className="group block p-8 rounded-2xl bg-white border-2 border-emerald-500 shadow-lg hover:shadow-xl hover:border-emerald-600 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-300"
          >
            <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-8 h-8 text-emerald-700" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Caregiver Center</h2>
            <p className="text-base text-slate-600 mb-6">
              Real-time adherence overview, overdue dose alerts, multi-caregiver responsibility claiming, and audit logs.
            </p>
            <span className="inline-flex items-center text-lg font-bold text-emerald-700 group-hover:translate-x-1 transition-transform">
              Open Caregiver Dashboard &rarr;
            </span>
          </Link>
        </div>

        {/* Feature Badges */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl bg-white shadow-sm border border-slate-100">
            <Activity className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">7-State Engine</div>
            <div className="text-xs text-slate-500">Scheduled, Reminded, Taken, Not yet, Unsure, Unconfirmed, Skipped</div>
          </div>
          <div className="p-4 rounded-xl bg-white shadow-sm border border-slate-100">
            <Bell className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">Alert Escalation</div>
            <div className="text-xs text-slate-500">Auto-flags unresolved doses</div>
          </div>
          <div className="p-4 rounded-xl bg-white shadow-sm border border-slate-100">
            <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">Claim System</div>
            <div className="text-xs text-slate-500">Coordinated care response</div>
          </div>
          <div className="p-4 rounded-xl bg-white shadow-sm border border-slate-100">
            <ShieldCheck className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">Audit Trail</div>
            <div className="text-xs text-slate-500">Immutable care logging</div>
          </div>
        </div>
      </div>
    </main>
  );
}
