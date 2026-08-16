import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import PaymentsClient, {
  type PaymentRow,
  type MerchantLite,
  type OpenInvoice,
  type CustodyRow,
} from "@/components/payments/PaymentsClient";

export default async function PaymentsPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.payments.view);

  const canCustody = ctx.permissions.has(PERMISSIONS.payments.custody);
  const canManage = ctx.permissions.has(PERMISSIONS.admin.usersManage);
  const supabase = await createClient();

  const [
    { data: payments },
    { data: merchants },
    { data: balances },
    { data: openInv },
    { data: custody },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, payment_number, payment_date, amount, method, merchant_id, rep_id, reference_no, settlement_id, notes",
      )
      .is("deleted_at", null)
      .order("payment_date", { ascending: false })
      .limit(300),
    supabase.from("merchants").select("id, name, assigned_rep").is("deleted_at", null).order("name"),
    supabase.from("v_merchant_balances").select("merchant_id, balance"),
    supabase
      .from("v_invoice_outstanding")
      .select("invoice_id, merchant_id, invoice_number, invoice_date, remaining")
      .gt("remaining", 0),
    canCustody
      ? supabase.from("v_rep_custody").select("rep_id, receipts_count, custody_amount")
      : Promise.resolve({ data: [] as CustodyRow[] }),
  ]);

  const balanceMap: Record<string, number> = {};
  for (const b of balances ?? []) if (b.merchant_id) balanceMap[b.merchant_id] = b.balance ?? 0;

  const merchantsLite: MerchantLite[] = (merchants ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    balance: balanceMap[m.id] ?? 0,
  }));

  // أسماء المندوبين (للعهدة/العرض) — للمدير فقط
  let repNames: Record<string, string> = {};
  if (canManage) {
    const { data: users } = await supabase.rpc("admin_list_users");
    for (const u of users ?? []) repNames[u.id] = u.full_name || u.email;
  }

  const rows: PaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id,
    payment_number: p.payment_number,
    payment_date: p.payment_date,
    amount: p.amount,
    method: p.method,
    merchant_id: p.merchant_id,
    merchant_name: merchantsLite.find((m) => m.id === p.merchant_id)?.name ?? "—",
    rep_id: p.rep_id,
    rep_name: p.rep_id ? repNames[p.rep_id] ?? "—" : "—",
    reference_no: p.reference_no,
    settled: p.settlement_id != null,
    notes: p.notes,
  }));

  const openInvoices: OpenInvoice[] = (openInv ?? []).map((o) => ({
    invoice_id: o.invoice_id ?? "",
    merchant_id: o.merchant_id ?? "",
    invoice_number: o.invoice_number,
    invoice_date: o.invoice_date,
    remaining: o.remaining ?? 0,
  }));

  const custodyRows: CustodyRow[] = (custody ?? []).map((c) => ({
    rep_id: c.rep_id ?? "",
    rep_name: c.rep_id ? repNames[c.rep_id] ?? "مندوب" : "—",
    receipts_count: c.receipts_count ?? 0,
    custody_amount: c.custody_amount ?? 0,
  }));

  return (
    <PaymentsClient
      payments={rows}
      merchants={merchantsLite}
      openInvoices={openInvoices}
      custody={custodyRows}
      canCreate={ctx.permissions.has(PERMISSIONS.payments.create)}
      canCustody={canCustody}
    />
  );
}
