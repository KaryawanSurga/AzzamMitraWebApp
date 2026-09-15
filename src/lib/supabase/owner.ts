import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/config/env.server";
import { authorizeOwner, type OwnerProfile } from "@/lib/auth/owner";
import { createClient } from "./server";

export async function getCurrentOwner(): Promise<OwnerProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return authorizeOwner(user, lookupOwner);
}

export async function lookupOwner(id: string): Promise<OwnerProfile | null> {
  const env = getServerEnv();
  const admin = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.from("users").select("id,email,display_name").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data;
}
