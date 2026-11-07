import { getSupabaseAdmin } from "@/lib/supabase";
import { extractMutationId, safeNumber } from "@/lib/moota";

function textValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

export async function processMootaPayload(payload: unknown, headers: Record<string, string>, signatureValid: boolean) {
  const supabase = getSupabaseAdmin();
  const items = Array.isArray(payload)
    ? payload.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : payload && typeof payload === "object"
      ? (() => {
          const record = payload as Record<string, unknown>;
          const list = Array.isArray(record.data) ? record.data : Array.isArray(record.mutations) ? record.mutations : null;
          return list ? list.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [record];
        })()
      : [];

  const { data: delivery, error: deliveryError } = await supabase
    .from("webhook_deliveries")
    .insert({
      provider: "moota",
      signature_valid: signatureValid,
      headers,
      payload: payload as object,
      item_count: items.length,
      processed_count: 0,
      status: "processing",
    })
    .select("id")
    .single();

  if (deliveryError || !delivery) throw new Error(`Gagal mencatat webhook: ${deliveryError?.message ?? "unknown error"}`);

  let processedCount = 0;
  let matchedCount = 0;
  let duplicateCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const mutationId = extractMutationId(item);
      const amount = safeNumber(item.amount);
      const type = textValue(item.type)?.toUpperCase() ?? "";

      if (!mutationId || amount === null || amount <= 0 || !["CR", "DB"].includes(type)) {
        errors.push("Mutasi diabaikan: mutation_id, amount, atau type tidak valid.");
        continue;
      }

      const mutationRecord = {
        mutation_id: mutationId,
        bank_id: textValue(item.bank_id),
        account_number: textValue(item.account_number),
        bank_type: textValue(item.bank_type),
        mutation_date: textValue(item.date),
        amount,
        type,
        balance: safeNumber(item.balance),
        description: textValue(item.description),
        note: textValue(item.note),
        payload: item,
        delivery_id: delivery.id,
        match_status: "unmatched",
      };

      const { data: inserted, error: mutationError } = await supabase
        .from("moota_mutations")
        .upsert(mutationRecord, { onConflict: "mutation_id", ignoreDuplicates: true })
        .select("id, mutation_id")
        .maybeSingle();

      if (mutationError) throw mutationError;
      if (!inserted) {
        duplicateCount += 1;
        processedCount += 1;
        continue;
      }

      processedCount += 1;

      if (type !== "CR") continue;

      const searchableText = `${textValue(item.note) ?? ""} ${textValue(item.description) ?? ""}`.toLowerCase();
      let transaction: { id: string; order_code: string } | null = null;
      let matchMethod: string | null = null;

      // Prefer explicit order-code matching in the note or description.
      const { data: pendingByAmount, error: pendingError } = await supabase
        .from("transactions")
        .select("id, order_code, amount")
        .eq("status", "pending")
        .eq("amount", amount)
        .order("created_at", { ascending: true })
        .limit(100);
      if (pendingError) throw pendingError;

      const explicitMatch = (pendingByAmount ?? []).find((candidate: { id: string; order_code: string; amount: number }) => searchableText.includes(String(candidate.order_code).toLowerCase()));
      if (explicitMatch) {
        transaction = explicitMatch;
        matchMethod = "order_code";
      } else if (process.env.AUTO_MATCH_UNIQUE_AMOUNT === "true" && (pendingByAmount ?? []).length === 1) {
        transaction = pendingByAmount![0];
        matchMethod = "unique_amount";
      }

      if (transaction) {
        const { data: updated, error: updateError } = await supabase
          .from("transactions")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            matched_mutation_id: mutationId,
            match_method: matchMethod,
          })
          .eq("id", transaction.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (updateError) throw updateError;

        if (updated) {
          await supabase.from("moota_mutations").update({ transaction_id: transaction.id, match_status: "matched" }).eq("mutation_id", mutationId);
          matchedCount += 1;
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Kesalahan saat memproses mutasi.");
    }
  }

  const finalStatus = errors.length > 0 ? (processedCount > 0 ? "processed_with_warnings" : "failed") : "processed";
  await supabase
    .from("webhook_deliveries")
    .update({ processed_count: processedCount, status: finalStatus, error_message: errors.length ? errors.join(" | ").slice(0, 2000) : null })
    .eq("id", delivery.id);

  return { deliveryId: delivery.id, received: items.length, processed: processedCount, matched: matchedCount, duplicates: duplicateCount, errors };
}
