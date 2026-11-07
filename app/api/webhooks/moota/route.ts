import { NextRequest, NextResponse } from "next/server";
import { verifyMootaSignature } from "@/lib/moota";
import { processMootaPayload } from "@/lib/webhook-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("signature") ?? request.headers.get("x-moota-signature");

  if (!process.env.MOOTA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret belum dikonfigurasi." }, { status: 503 });
  }

  const signatureValid = verifyMootaSignature(rawBody, signature);
  if (!signatureValid) {
    return NextResponse.json({ error: "Signature tidak valid." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload harus berupa JSON yang valid." }, { status: 400 });
  }

  try {
    const safeHeaders: Record<string, string> = {};
    for (const key of ["content-type", "user-agent", "x-forwarded-for"]) {
      const value = request.headers.get(key);
      if (value) safeHeaders[key] = value;
    }
    const result = await processMootaPayload(payload, safeHeaders, true);
    return NextResponse.json({ ...result, ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook gagal diproses." }, { status: 500 });
  }
}
