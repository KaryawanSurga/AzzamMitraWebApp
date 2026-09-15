import type { User } from "@supabase/supabase-js";

export type OwnerProfile = { id: string; email: string; display_name: string };
export type OwnerLookup = (id: string) => Promise<OwnerProfile | null>;

export async function authorizeOwner(user: User | null, lookup: OwnerLookup): Promise<OwnerProfile | null> {
  if (!user) return null;
  return lookup(user.id);
}
