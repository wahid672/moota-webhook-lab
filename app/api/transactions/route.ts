import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function makeOrderCode() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `MTA-${stamp}-${random}`;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("transactions")
      .select("id, order_code, customer_name, description, amount, status, created_at, paid_at, matched_mutation_id, match_method")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengambil transaksi." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerName = typeof body.customer_name === "string" ? body.customer_name.trim().slice(0, 120) : "Pelanggan Sandbox";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 250) : "Transaksi pengujian Moota";
    const amount = Number(body.amount);

    if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 1_000_000_000) {
      return NextResponse.json({ error: "Nominal harus berupa bilangan bulat antara Rp1.000 dan Rp1.000.000.000." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("transactions")
      .insert({ order_code: makeOrderCode(), customer_name: customerName || "Pelanggan Sandbox", description: description || "Transaksi pengujian Moota", amount, status: "pending" })
      .select("id, order_code, customer_name, description, amount, status, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat transaksi." }, { status: 500 });
  }
}
