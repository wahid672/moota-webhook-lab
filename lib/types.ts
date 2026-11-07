export type TransactionStatus = "pending" | "paid" | "unmatched" | "cancelled";

export type Transaction = {
  id: string;
  order_code: string;
  customer_name: string | null;
  description: string | null;
  amount: number;
  status: TransactionStatus;
  created_at: string;
  paid_at: string | null;
  matched_mutation_id: string | null;
  match_method: string | null;
};

export type MootaMutation = {
  mutation_id?: string;
  id?: string;
  bank_id?: string;
  account_number?: string | number;
  bank_type?: string;
  date?: string;
  amount?: number | string;
  type?: string;
  balance?: number | string;
  description?: string;
  note?: string;
  token?: string;
  [key: string]: unknown;
};
