"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserRole } from "@/types/database";
import {
  signInUser,
  signUpUser,
  signOutUser,
  getLinkedEldersAction,
} from "@/app/actions/auth";

export interface UserSession {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export interface LinkedElder {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}

interface AuthContextType {
  user: UserSession | null;
  role: UserRole | null;
  loading: boolean;
  linkedElders: LinkedElder[];
  activeElderId: string | null;
  setActiveElderId: (id: string | null) => void;
  refreshLinkedElders: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    phone?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedElders, setLinkedElders] = useState<LinkedElder[]>([]);
  const [activeElderId, setActiveElderId] = useState<string | null>(null);

  const supabase = createClient();

  const refreshLinkedElders = async () => {
    try {
      const elders = await getLinkedEldersAction();
      setLinkedElders(elders);
      if (elders.length > 0 && !activeElderId) {
        setActiveElderId(elders[0].id);
      }
    } catch (err) {
      console.error("Failed to load linked elders:", err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("role, full_name")
            .eq("id", session.user.id)
            .maybeSingle();

          const userRole: UserRole =
            profile?.role || (session.user.user_metadata?.role as UserRole) || "elder";
          const fullName =
            profile?.full_name || session.user.user_metadata?.full_name || "CareLedger User";

          setUser({
            id: session.user.id,
            email: session.user.email || "",
            role: userRole,
            fullName,
          });
          setRole(userRole);

          if (userRole === "caregiver") {
            const elders = await getLinkedEldersAction();
            setLinkedElders(elders);
            if (elders.length > 0) {
              setActiveElderId(elders[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("role, full_name")
          .eq("id", session.user.id)
          .maybeSingle();

        const userRole: UserRole =
          profile?.role || (session.user.user_metadata?.role as UserRole) || "elder";
        const fullName =
          profile?.full_name || session.user.user_metadata?.full_name || "CareLedger User";

        setUser({
          id: session.user.id,
          email: session.user.email || "",
          role: userRole,
          fullName,
        });
        setRole(userRole);

        if (userRole === "caregiver") {
          const elders = await getLinkedEldersAction();
          setLinkedElders(elders);
          if (elders.length > 0) {
            setActiveElderId(elders[0].id);
          }
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setRole(null);
        setLinkedElders([]);
        setActiveElderId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    const res = await signInUser({ email, password: pass });
    if (res.success && res.user) {
      setUser(res.user);
      setRole(res.user.role);
      if (res.user.role === "caregiver") {
        await refreshLinkedElders();
      }
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const signUp = async (params: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    phone?: string;
  }) => {
    const res = await signUpUser(params);
    if (res.success && res.user) {
      setUser(res.user);
      setRole(res.user.role);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const signOut = async () => {
    await signOutUser();
    setUser(null);
    setRole(null);
    setLinkedElders([]);
    setActiveElderId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        linkedElders,
        activeElderId,
        setActiveElderId,
        refreshLinkedElders,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
