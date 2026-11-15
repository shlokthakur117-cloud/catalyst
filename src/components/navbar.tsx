"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { HeartPulse, User, ShieldCheck, LogOut, LogIn, PlusCircle } from "lucide-react";
import { ClaimInviteModal } from "@/components/claim-invite-modal";

export function Navbar() {
  const { user, role, signOut, linkedElders, activeElderId, setActiveElderId } = useAuth();
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <HeartPulse className="w-5 h-5" />
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight">CareLedger</span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Role Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    role === "elder"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {role === "elder" ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span className="capitalize">{role}</span>
                </span>

                {/* If Caregiver: Elder Selector */}
                {role === "caregiver" && (
                  <div className="hidden sm:flex items-center gap-2">
                    {linkedElders.length > 0 ? (
                      <select
                        value={activeElderId || ""}
                        onChange={(e) => setActiveElderId(e.target.value)}
                        className="rounded-lg border border-slate-300 py-1.5 px-2.5 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {linkedElders.map((elder) => (
                          <option key={elder.id} value={elder.id}>
                            Elder: {elder.fullName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setIsClaimModalOpen(true)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Link Elder</span>
                      </button>
                    )}
                  </div>
                )}

                <span className="text-sm font-semibold text-slate-700 hidden md:inline">
                  {user.fullName}
                </span>

                <button
                  onClick={() => signOut()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                >
                  <span>Register</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <ClaimInviteModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
      />
    </>
  );
}
