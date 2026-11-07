import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  // Vercel Marketplace's current Supabase integration provides SUPABASE_SECRET_KEY.
  // Keep legacy names as fallbacks for existing/manual Supabase projects and local development.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Supabase belum terhubung. Tambahkan Supabase melalui Vercel Marketplace agar SUPABASE_URL dan SUPABASE_SECRET_KEY tersedia.",
    );
  }

  if (!client) {
    client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}
