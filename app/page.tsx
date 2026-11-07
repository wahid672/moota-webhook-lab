"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Transaction = {
  id: string;
  order_code: string;
  customer_name: string | null;
  description: string | null;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  matched_mutation_id: string | null;
  match_method: string | null;
};
type Mutation = {
  id: string;
  mutation_id: string;
  bank_type: string | null;
  account_number: string | null;
  mutation_date: string | null;
  amount: number;
  type: string;
  description: string | null;
  note: string | null;
  match_status: string;
  received_at: string;
};
type Delivery = {
  id: string;
  received_at: string;
  signature_valid: boolean;
  item_count: number;
  processed_count: number;
  status: string;
  error_message: string | null;
  payload: unknown;
};
type Dashboard = {
  stats: { total: number; pending: number; paid: number; webhookCount: number; matchedCount: number };
  transactions: Transaction[];
  mutations: Mutation[];
  deliveries: Delivery[];
  config: { mootaApi: boolean; webhookSecret: boolean };
};

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [customerName, setCustomerName] = useState("Pelanggan Sandbox");
  const [description, setDescription] = useState("Uji integrasi webhook Moota");
  const [amount, setAmount] = useState("100000");
  const [tab, setTab] = useState<"transactions" | "mutations" | "webhooks">("transactions");

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tidak dapat memuat dashboard.");
      setDashboard(result);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Terjadi kesalahan." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const paidRate = useMemo(() => {
    if (!dashboard?.stats.total) return 0;
    return Math.round((dashboard.stats.paid / dashboard.stats.total) * 100);
  }, [dashboard]);

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setNotice(null);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: customerName, description, amount: Number(amount) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Transaksi gagal dibuat.");
      setNotice({ type: "success", text: `Transaksi ${result.data.order_code} berhasil dibuat dengan status Pending.` });
      setAmount("100000");
      await loadDashboard(true);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Terjadi kesalahan." });
    } finally {
      setCreating(false);
    }
  }

  async function createSandboxMutation(transaction: Transaction) {
    const confirmed = window.confirm(`Buat mutasi dummy Sandbox sebesar ${rupiah(transaction.amount)} untuk ${transaction.order_code}?`);
    if (!confirmed) return;
    setBusyId(transaction.id);
    setNotice(null);
    try {
      const response = await fetch("/api/moota/sandbox-mutation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transaction.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Moota gagal membuat mutasi dummy.");
      setNotice({ type: "success", text: result.message ?? "Permintaan mutasi dummy dikirim." });
      await loadDashboard(true);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Terjadi kesalahan." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark">M</div><div><strong>Moota Lab</strong><span>Webhook testing</span></div></div>
        <div className="sidebar-label">WORKSPACE</div>
        <button type="button" className={`side-link ${tab === "transactions" ? "active" : ""}`} onClick={() => setTab("transactions")}><span className="side-icon">↗</span> Transactions</button>
        <button type="button" className={`side-link ${tab === "webhooks" ? "active" : ""}`} onClick={() => setTab("webhooks")}><span className="side-icon">⌁</span> Webhook logs</button>
        <div className="sidebar-bottom"><div className="sandbox-pill"><span className="pulse-dot"/> SANDBOX MODE</div><p>Lingkungan pengujian. Jangan gunakan kredensial produksi untuk eksperimen.</p></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div><div className="eyebrow">DEVELOPER WORKSPACE / OVERVIEW</div><h1>Moota Webhook Testing Lab</h1><p>Uji transaksi, mutasi Sandbox, dan penerimaan webhook dalam satu tempat.</p></div><button className="button button-secondary" onClick={() => loadDashboard(true)} disabled={refreshing}>↻ {refreshing ? "Memuat..." : "Refresh data"}</button></header>

        {notice && <div className={`notice ${notice.type}`}><span>{notice.type === "success" ? "✓" : notice.type === "error" ? "!" : "i"}</span><p>{notice.text}</p><button onClick={() => setNotice(null)} aria-label="Tutup notifikasi">×</button></div>}

        <div className="status-strip">
          <div className="status-item"><span className={`status-dot ${dashboard?.config.mootaApi ? "ok" : "off"}`}/><span>Moota API</span><strong>{dashboard?.config.mootaApi ? "Configured" : "Belum dikonfigurasi"}</strong></div>
          <div className="status-item"><span className={`status-dot ${dashboard?.config.webhookSecret ? "ok" : "off"}`}/><span>Webhook secret</span><strong>{dashboard?.config.webhookSecret ? "Configured" : "Belum dikonfigurasi"}</strong></div>
          <div className="status-item"><span className="status-dot ok"/><span>Environment</span><strong>Sandbox / V1</strong></div>
        </div>

        <div className="stats-grid">
          <StatCard label="Total transaksi" value={dashboard?.stats.total ?? 0} helper="Seluruh transaksi pengujian" icon="▤" />
          <StatCard label="Menunggu pembayaran" value={dashboard?.stats.pending ?? 0} helper="Status pending" icon="◷" />
          <StatCard label="Pembayaran terkonfirmasi" value={dashboard?.stats.paid ?? 0} helper={`${paidRate}% dari total transaksi`} icon="✓" accent="green" />
          <StatCard label="Webhook diterima" value={dashboard?.stats.webhookCount ?? 0} helper={`${dashboard?.stats.matchedCount ?? 0} mutasi cocok`} icon="⌁" accent="blue" />
        </div>

        <div className="content-grid">
          <section className="panel create-panel">
            <div className="panel-heading"><div><div className="eyebrow">TRANSACTION SIMULATOR</div><h2>Buat transaksi uji</h2></div><span className="step-tag">01 / 03</span></div>
            <p className="panel-description">Buat pesanan lokal dengan status Pending. Setelah itu, kirim mutasi dummy ke akun Sandbox Moota.</p>
            <form onSubmit={createTransaction} className="transaction-form">
              <label>Nama pelanggan<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Contoh: Pelanggan Sandbox" maxLength={120}/></label>
              <label>Deskripsi transaksi<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: Pembelian produk" maxLength={250}/></label>
              <label>Nominal transaksi (IDR)<div className="amount-input"><span>Rp</span><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="100000" required/></div></label>
              <button className="button button-primary full" type="submit" disabled={creating}>{creating ? "Membuat transaksi..." : "+ Buat transaksi pending"}</button>
            </form>
            <div className="form-footnote"><span>ⓘ</span> Transaksi ini hanya tersimpan di database aplikasi. Belum ada uang yang dipindahkan.</div>
          </section>

          <section className="panel flow-panel">
            <div className="panel-heading"><div><div className="eyebrow">INTEGRATION FLOW</div><h2>Alur pengujian</h2></div><span className="step-tag">3 STEPS</span></div>
            <div className="flow-list">
              <FlowStep number="01" title="Buat transaksi" detail="Aplikasi menyimpan order dengan status Pending." state="done"/>
              <div className="flow-connector"/>
              <FlowStep number="02" title="Kirim mutasi Sandbox" detail="API Moota membuat mutasi kredit dengan kode order pada catatan." state="active"/>
              <div className="flow-connector"/>
              <FlowStep number="03" title="Terima webhook" detail="Vercel memvalidasi Signature, menyimpan mutasi, lalu mencocokkan transaksi." state="waiting"/>
            </div>
            <div className="flow-note"><strong>Catatan pencocokan</strong><span>Kode order pada note/description menjadi prioritas. Pencocokan nominal otomatis hanya dilakukan jika tepat satu transaksi pending memiliki nominal tersebut.</span></div>
          </section>
        </div>

        <section className="panel data-panel">
          <div className="panel-heading data-heading"><div><div className="eyebrow">LIVE DATA</div><h2>Aktivitas integrasi</h2></div><div className="tabs"><button className={tab === "transactions" ? "selected" : ""} onClick={() => setTab("transactions")}>Transaksi <span>{dashboard?.transactions.length ?? 0}</span></button><button className={tab === "mutations" ? "selected" : ""} onClick={() => setTab("mutations")}>Mutasi <span>{dashboard?.mutations.length ?? 0}</span></button><button className={tab === "webhooks" ? "selected" : ""} onClick={() => setTab("webhooks")}>Webhook <span>{dashboard?.deliveries.length ?? 0}</span></button></div></div>
          {loading ? <div className="empty-state">Memuat data dashboard...</div> : !dashboard ? <div className="empty-state">Dashboard belum dapat dimuat. Periksa konfigurasi Supabase.</div> : tab === "transactions" ? (
            <div className="table-wrap"><table><thead><tr><th>KODE TRANSAKSI</th><th>PELANGGAN</th><th>NOMINAL</th><th>STATUS</th><th>DIBUAT</th><th>AKSI</th></tr></thead><tbody>
              {dashboard.transactions.map((transaction) => <tr key={transaction.id}><td><strong className="mono">{transaction.order_code}</strong><small>{transaction.description}</small></td><td>{transaction.customer_name || "-"}</td><td className="amount-cell">{rupiah(transaction.amount)}</td><td><StatusBadge status={transaction.status}/></td><td>{dateTime(transaction.created_at)}</td><td>{transaction.status === "pending" ? <button className="button button-small button-outline" disabled={!dashboard.config.mootaApi || busyId === transaction.id} onClick={() => createSandboxMutation(transaction)}>{busyId === transaction.id ? "Mengirim..." : "Kirim mutasi Sandbox"}</button> : <span className="muted">{transaction.match_method ? `Match: ${transaction.match_method}` : "-"}</span>}</td></tr>)}
              {dashboard.transactions.length === 0 && <tr><td colSpan={6}><div className="empty-state">Belum ada transaksi. Buat transaksi pengujian pertama.</div></td></tr>}
            </tbody></table></div>
          ) : tab === "mutations" ? (
            <div className="table-wrap"><table><thead><tr><th>MUTATION ID</th><th>BANK / REKENING</th><th>TIPE</th><th>NOMINAL</th><th>CATATAN / DESKRIPSI</th><th>STATUS MATCH</th></tr></thead><tbody>
              {dashboard.mutations.map((mutation) => <tr key={mutation.id}><td className="mono">{mutation.mutation_id}</td><td>{mutation.bank_type || "-"}<small>{mutation.account_number || ""}</small></td><td><span className={`type-pill ${mutation.type === "CR" ? "credit" : "debit"}`}>{mutation.type}</span></td><td className="amount-cell">{rupiah(mutation.amount)}</td><td>{mutation.note || mutation.description || "-"}</td><td><StatusBadge status={mutation.match_status}/></td></tr>)}
              {dashboard.mutations.length === 0 && <tr><td colSpan={6}><div className="empty-state">Belum ada mutasi yang diterima.</div></td></tr>}
            </tbody></table></div>
          ) : (
            <div className="table-wrap"><table><thead><tr><th>WAKTU DITERIMA</th><th>SIGNATURE</th><th>ITEM</th><th>DIPROSES</th><th>STATUS</th><th>CATATAN</th><th>PAYLOAD</th></tr></thead><tbody>
              {dashboard.deliveries.map((delivery) => <tr key={delivery.id}><td>{dateTime(delivery.received_at)}</td><td><StatusBadge status={delivery.signature_valid ? "valid" : "invalid"}/></td><td>{delivery.item_count}</td><td>{delivery.processed_count}</td><td><StatusBadge status={delivery.status}/></td><td className="error-cell">{delivery.error_message || "-"}</td><td><details className="payload-details"><summary>Lihat JSON</summary><pre>{JSON.stringify(delivery.payload, null, 2)}</pre></details></td></tr>)}
              {dashboard.deliveries.length === 0 && <tr><td colSpan={7}><div className="empty-state">Belum ada webhook masuk. Setelah endpoint didaftarkan di Moota, kirim mutasi Sandbox untuk memulai pengujian.</div></td></tr>}
            </tbody></table></div>
          )}
        </section>

        <footer className="footer"><span>Moota Webhook Testing Lab <b>V1.0</b></span><span>Next.js · Supabase · Vercel</span></footer>
      </section>
    </main>
  );
}

function StatCard({ label, value, helper, icon, accent = "" }: { label: string; value: number; helper: string; icon: string; accent?: string }) {
  return <div className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value.toLocaleString("id-ID")}</div><div className="stat-helper">{helper}</div></div>;
}
function FlowStep({ number, title, detail, state }: { number: string; title: string; detail: string; state: string }) {
  return <div className="flow-step"><div className={`flow-number ${state}`}>{state === "done" ? "✓" : number}</div><div><strong>{title}</strong><span>{detail}</span></div><i>{state === "done" ? "Ready" : state === "active" ? "Next" : "Waiting"}</i></div>;
}
function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const label: Record<string, string> = { pending: "Pending", paid: "Paid", unmatched: "Belum cocok", matched: "Cocok", cancelled: "Dibatalkan", valid: "Valid", invalid: "Invalid", processed: "Processed", processed_with_warnings: "Warnings", failed: "Failed", processing: "Processing" };
  const tone = ["paid", "matched", "valid", "processed"].includes(normalized) ? "green" : ["pending", "processing"].includes(normalized) ? "amber" : ["invalid", "failed", "cancelled"].includes(normalized) ? "red" : "gray";
  return <span className={`badge ${tone}`}>{label[normalized] ?? status}</span>;
}
