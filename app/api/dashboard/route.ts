import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [transactions, mutations, deliveries, totalCounts, pendingCounts, paidCounts, deliveryCounts] = await Promise.all([
      supabase.from("transactions").select("id, order_code, customer_name, description, amount, status, created_at, paid_at, matched_mutation_id, match_method").order("created_at", { ascending: false }).limit(50),
      supabase.from("moota_mutations").select("id, mutation_id, bank_type, account_number, mutation_date, amount, type, description, note, match_status, received_at").order("received_at", { ascending: false }).limit(30),
      supabase.from("webhook_deliveries").select("id, received_at, signature_valid, item_count, processed_count, status, error_message, payload").order("received_at", { ascending: false }).limit(20),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "paid"),
      supabase.from("webhook_deliveries").select("id", { count: "exact", head: true }),
    ]);

    const firstError = transactions.error ?? mutations.error ?? deliveries.error ?? totalCounts.error ?? pendingCounts.error ?? paidCounts.error ?? deliveryCounts.error;
    if (firstError) throw firstError;

    const allTransactions = transactions.data ?? [];
    return NextResponse.json({
      stats: {
        total: totalCounts.count ?? allTransactions.length,
        pending: pendingCounts.count ?? allTransactions.filter((item: { status: string }) => item.status === "pending").length,
        paid: paidCounts.count ?? allTransactions.filter((item: { status: string }) => item.status === "paid").length,
        webhookCount: deliveryCounts.count ?? deliveries.data?.length ?? 0,
        matchedCount: mutations.data?.filter((item: { match_status: string }) => item.match_status === "matched").length ?? 0,
      },
      transactions: allTransactions,
      mutations: mutations.data ?? [],
      deliveries: deliveries.data ?? [],
      config: {
        mootaApi: Boolean(process.env.MOOTA_API_TOKEN && process.env.MOOTA_SANDBOX_BANK_ID),
        webhookSecret: Boolean(process.env.MOOTA_WEBHOOK_SECRET),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat dashboard." }, { status: 500 });
  }
}
