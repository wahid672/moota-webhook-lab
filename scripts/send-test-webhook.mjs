import crypto from "node:crypto";

const secret = process.env.MOOTA_WEBHOOK_SECRET;
if (!secret) {
  console.error("MOOTA_WEBHOOK_SECRET belum diisi di .env.local");
  process.exit(1);
}

const url = process.env.TEST_WEBHOOK_URL || "http://localhost:3000/api/webhooks/moota";
const amount = Number(process.env.TEST_AMOUNT || 100000);
const orderCode = process.env.TEST_ORDER_CODE || `MTA-TEST-${Date.now()}`;
const payload = [{
  mutation_id: `local-test-${Date.now()}`,
  bank_id: "sandbox-test",
  account_number: "0000000000",
  bank_type: "SANDBOX",
  date: new Date().toISOString(),
  amount,
  type: "CR",
  balance: amount,
  description: `TEST WEBHOOK ${orderCode}`,
  note: orderCode
}];
const rawBody = JSON.stringify(payload);
const signature = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Signature: signature },
  body: rawBody
});
const responseBody = await response.text();
console.log(`HTTP ${response.status}`);
console.log(responseBody);
if (!response.ok) process.exit(1);
