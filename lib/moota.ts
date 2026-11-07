import crypto from "node:crypto";

export function verifyMootaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.MOOTA_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const supplied = signatureHeader.trim().replace(/^sha256=/i, "").toLowerCase();
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
  const suppliedBuffer = Buffer.from(supplied, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function normalizeMutations(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    if (Array.isArray(record.mutations)) return record.mutations.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    return [record];
  }
  return [];
}

export function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

export function extractMutationId(mutation: Record<string, unknown>): string | null {
  const value = mutation.mutation_id ?? mutation.id;
  return value === undefined || value === null ? null : String(value);
}
