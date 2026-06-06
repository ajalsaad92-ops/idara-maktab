import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "manager" | "employee";

type Profile = { id: string; full_name: string; department: string | null };

type Ctx = {
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref to track the latest user ID being loaded - prevents race conditions
  const loadingUserId = useRef<string | null>(null);

  const loadDetails = async (u: User | null) => {
    if (!u) {
      setProfile(null);
      setRole(null);
      return;
    }
    // Mark this user ID as the one currently being loaded
    loadingUserId.current = u.id;
    
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, department").eq("id", u.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.id),
    ]);
    
    // Only update state if this is still the current user being loaded
    if (loadingUserId.current !== u.id) return;
    
    setProfile(p as Profile | null);
    // pick highest role
    const roles = (r ?? []).map((x: any) => x.role as Role);
    const pick: Role = roles.includes("admin")
      ? "admin"
      : roles.includes("manager")
        ? "manager"
        : "employee";
    setRole(pick);
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (mounted) {
        loadDetails(u);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (mounted) {
        loadDetails(u).finally(() => {
          if (mounted) setLoading(false);
        });
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };
  const refresh = async () => loadDetails(user);

  return (
    <AuthCtx.Provider value={{ user, profile, role, loading, signIn, signOut, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
