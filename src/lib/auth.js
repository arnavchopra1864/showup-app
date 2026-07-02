import { supabase, isSupabaseConfigured } from "./supabase";

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) return { ok: true, mock: true };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getProfile() {
  if (!isSupabaseConfigured) return { ok: true, profile: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: true, profile: null };
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { ok: true, profile: data ?? null };
}

export async function createProfile({ name, handle, avatar }) {
  if (!isSupabaseConfigured) return { ok: true, mock: true };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const cleanHandle = handle.replace(/^@+/, "").toLowerCase();
  const { error } = await supabase
    .from("profiles")
    .insert({ id: user.id, name, handle: cleanHandle, avatar });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "that handle is taken" : error.message };
  }

  await supabase.rpc("grant_welcome_bonus");
  return { ok: true };
}
