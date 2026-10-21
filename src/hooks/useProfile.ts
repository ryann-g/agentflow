import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/**
 * The only columns a user may change themselves.
 *
 * `ProfileUpdate` also covers `plan`, `subscription_status` and the
 * PayMongo/Stripe identifiers. The database revokes UPDATE on those columns
 * for the `authenticated` role (migration 007), so a call would fail — but
 * the type should not invite the call in the first place. The database is
 * the backstop; this type is the first line.
 */
type ProfileEditableFields = Pick<ProfileUpdate, "full_name" | "brokerage">;

export async function fetchProfile(): Promise<{ data: Profile | null; error: string | null }> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateProfile(
  updates: ProfileEditableFields
): Promise<{ data: Profile | null; error: string | null }> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
