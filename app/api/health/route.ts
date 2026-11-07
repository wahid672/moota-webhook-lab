import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const configured = {
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    mootaApi: Boolean(process.env.MOOTA_API_TOKEN && process.env.MOOTA_SANDBOX_BANK_ID),
    webhookSecret: Boolean(process.env.MOOTA_WEBHOOK_SECRET),
    dashboardProtection: Boolean(process.env.LAB_DASHBOARD_USER && process.env.LAB_DASHBOARD_PASSWORD),
  };

  let database = false;
  let databaseError: string | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("transactions").select("id", { head: true, count: "exact" });
    if (error) throw error;
    database = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database check failed";
  }

  return NextResponse.json({ ok: database, configured, database, databaseError }, { status: database ? 200 : 503 });
}
