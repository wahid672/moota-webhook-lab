import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = process.env.MOOTA_API_TOKEN;
    const bankId = process.env.MOOTA_SANDBOX_BANK_ID;
    if (!token || !bankId) {
      return NextResponse.json({ error: "MOOTA_API_TOKEN dan MOOTA_SANDBOX_BANK_ID belum diatur di Environment Variables." }, { status: 503 });
    }

    const { transaction_id } = await request.json();
    if (typeof transaction_id !== "string") return NextResponse.json({ error: "transaction_id wajib diisi." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id, order_code, amount, status")
      .eq("id", transaction_id)
      .single();
    if (transactionError || !transaction) throw transactionError ?? new Error("Transaksi tidak ditemukan.");
    if (transaction.status !== "pending") return NextResponse.json({ error: "Hanya transaksi pending yang dapat dibuatkan mutasi dummy." }, { status: 409 });

    const response = await fetch(`https://app.moota.co/api/v2/mutation/store/${encodeURIComponent(bankId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 19).replace("T", " "),
        note: transaction.order_code,
        amount: String(transaction.amount),
        type: "CR",
      }),
      cache: "no-store",
    });

    const responseText = await response.text();
    let result: unknown = responseText;
    try { result = JSON.parse(responseText); } catch { /* preserve raw text */ }
    if (!response.ok) {
      return NextResponse.json({ error: "Moota menolak pembuatan mutasi dummy.", status: response.status, details: result }, { status: 502 });
    }

    const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
    const rawNested = record.data ?? record.mutation;
    const nested = Array.isArray(rawNested)
      ? (rawNested[0] && typeof rawNested[0] === "object" ? rawNested[0] as Record<string, unknown> : {})
      : rawNested && typeof rawNested === "object" ? rawNested as Record<string, unknown> : {};
    const mutationId = record.mutation_id ?? record.id ?? record.token ?? nested.mutation_id ?? nested.id ?? nested.token;
    let pushResult: unknown = null;

    // If Moota returns a mutation ID, request an immediate webhook push for easier testing.
    if (mutationId) {
      const pushResponse = await fetch(`https://app.moota.co/api/v2/mutation/${encodeURIComponent(String(mutationId))}/webhook`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      const pushText = await pushResponse.text();
      try { pushResult = { status: pushResponse.status, body: JSON.parse(pushText) }; }
      catch { pushResult = { status: pushResponse.status, body: pushText }; }
    }

    return NextResponse.json({
      ok: true,
      message: "Permintaan mutasi dummy berhasil dikirim ke Moota. Periksa log webhook untuk memastikan notifikasi diterima.",
      moota: result,
      webhookPush: pushResult,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat mutasi Sandbox." }, { status: 500 });
  }
}
