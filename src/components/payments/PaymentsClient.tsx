"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
  recordPayment,
  voidPayment,
  settleCustody,
  type PaymentInput,
} from "@/app/(app)/payments/actions";

export type MerchantLite = { id: string; name: string; balance: number };
export type PaymentRow = {
  id: string;
  payment_number: string | null;
  payment_date: string;
  amount: number;
  method: string;
  merchant_id: string;
  merchant_name: string;
  rep_id: string | null;
  rep_name: string;
  reference_no: string | null;
  settled: boolean;
  notes: string | null;
};
export type OpenInvoice = {
  invoice_id: string;
  merchant_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  remaining: number;
};
export type CustodyRow = {
  rep_id: string;
  rep_name: string;
  receipts_count: number;
  custody_amount: number;
};

type Props = {
  payments: PaymentRow[];
  merchants: MerchantLite[];
  openInvoices: OpenInvoice[];
  custody: CustodyRow[];
  canCreate: boolean;
  canCustody: boolean;
};

const METHOD: Record<string, string> = { cash: "نقد", transfer: "تحويل", cheque: "صك" };
const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentsClient({
  payments,
  merchants,
  openInvoices,
  custody,
  canCreate,
  canCustody,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);

  // ---- record modal ----
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "transfer" | "cheque">("cash");
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [alloc, setAlloc] = useState<Record<string, string>>({});

  const merchant = merchants.find((m) => m.id === merchantId);
  const merchantInvoices = useMemo(
    () => openInvoices.filter((o) => o.merchant_id === merchantId),
    [openInvoices, merchantId],
  );
  const allocSum = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0),
    [alloc],
  );

  function openNew() {
    setMerchantId("");
    setAmount("");
    setMethod("cash");
    setDate(today());
    setReference("");
    setNotes("");
    setAlloc({});
    setError(null);
    setOpen(true);
  }

  function autoAllocate() {
    let left = Number(amount) || 0;
    const next: Record<string, string> = {};
    for (const inv of [...merchantInvoices].sort((a, b) =>
      (a.invoice_date ?? "").localeCompare(b.invoice_date ?? ""),
    )) {
      if (left <= 0) break;
      const take = Math.min(left, inv.remaining);
      if (take > 0) {
        next[inv.invoice_id] = String(Math.round(take));
        left -= take;
      }
    }
    setAlloc(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount) || 0;
    if (!merchantId) return setError("اختر التاجر.");
    if (amt <= 0) return setError("المبلغ يجب أن يكون أكبر من صفر.");
    if (allocSum > amt + 0.001)
      return setError("مجموع التخصيصات يتجاوز مبلغ السند.");

    const input: PaymentInput = {
      merchant_id: merchantId,
      amount: amt,
      method,
      payment_date: date,
      reference_no: method === "cash" ? null : reference.trim() || null,
      notes: notes.trim() || null,
      allocations: Object.entries(alloc)
        .map(([invoice_id, v]) => ({ invoice_id, amount: Number(v) || 0 }))
        .filter((a) => a.amount > 0),
    };
    startTransition(async () => {
      const res = await recordPayment(input);
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function doVoid(p: PaymentRow) {
    if (!confirm(`إلغاء سند القبض ${p.payment_number ?? ""} (${fmtMoney(p.amount)})؟`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await voidPayment(p.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الإلغاء");
      else router.refresh();
    });
  }

  function doSettle(rep: CustodyRow) {
    const ids = payments
      .filter((p) => p.method === "cash" && !p.settled && p.rep_id === rep.rep_id)
      .map((p) => p.id);
    if (ids.length === 0) {
      setRowError("لا توجد سندات نقدية غير مسلَّمة لهذا المندوب.");
      return;
    }
    if (!confirm(`تسليم عهدة ${rep.rep_name} (${fmtMoney(rep.custody_amount)} من ${ids.length} سند) للصندوق؟`))
      return;
    setRowError(null);
    startTransition(async () => {
      const res = await settleCustody(rep.rep_id, ids, today(), null);
      if (!res.ok) setRowError(res.error ?? "تعذّر التسليم");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">التحصيلات</h1>
          <p className="text-muted mt-1 text-sm">
            سندات القبض من التجار. التحصيل مستقل عن الفاتورة، ويُخصم من رصيد التاجر.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openNew}
            className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition"
          >
            + سند قبض
          </button>
        )}
      </div>

      {rowError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{rowError}</p>}

      {/* عهدة المندوبين */}
      {canCustody && custody.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-3 text-sm">عهدة المندوبين (نقد غير مسلَّم للصندوق)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {custody.map((c) => (
              <div key={c.rep_id} className="border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.rep_name}</div>
                  <div className="text-xs text-muted">{c.receipts_count} سند</div>
                  <div className="tabular font-semibold mt-1">{fmtMoney(c.custody_amount)} د.ع</div>
                </div>
                <button
                  disabled={pending}
                  onClick={() => doSettle(c)}
                  className="text-sm bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg px-3 py-1.5 transition disabled:opacity-40"
                >
                  تسليم
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* قائمة السندات */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الرقم</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">التاجر</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">الطريقة</th>
                <th className="px-4 py-3 font-medium">المندوب</th>
                <th className="px-4 py-3 font-medium">العهدة</th>
                {canCreate && <th className="px-4 py-3 font-medium">إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 tabular" dir="ltr">{p.payment_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted tabular">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3">{p.merchant_name}</td>
                  <td className="px-4 py-3 tabular font-medium">{fmtMoney(p.amount)}</td>
                  <td className="px-4 py-3 text-muted">
                    {METHOD[p.method] ?? p.method}
                    {p.reference_no ? <span className="text-xs"> · {p.reference_no}</span> : ""}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.rep_name}</td>
                  <td className="px-4 py-3">
                    {p.method === "cash" ? (
                      p.settled ? (
                        <span className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">مُسلَّمة</span>
                      ) : (
                        <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1">بالعهدة</span>
                      )
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  {canCreate && (
                    <td className="px-4 py-3">
                      {!p.settled ? (
                        <button
                          disabled={pending}
                          onClick={() => doVoid(p)}
                          className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40"
                        >
                          إلغاء
                        </button>
                      ) : (
                        <span className="text-xs text-muted">مقفل</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={canCreate ? 8 : 7} className="px-4 py-10 text-center text-muted">
                    لا توجد سندات قبض بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal سند قبض */}
      <Modal open={open} onClose={() => setOpen(false)} title="سند قبض جديد" wide>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="التاجر *">
              <select
                value={merchantId}
                onChange={(e) => {
                  setMerchantId(e.target.value);
                  setAlloc({});
                }}
                className={inputCls}
              >
                <option value="">— اختر تاجراً —</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
            <Field label="المبلغ *">
              <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" className={inputCls} />
            </Field>
            <Field label="التاريخ">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className={inputCls} />
            </Field>
            <Field label="طريقة الدفع">
              <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={inputCls}>
                <option value="cash">نقد</option>
                <option value="transfer">تحويل</option>
                <option value="cheque">صك</option>
              </select>
            </Field>
            {method !== "cash" && (
              <Field label="رقم الصك / التحويل">
                <input value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" className={inputCls} />
              </Field>
            )}
            <Field label="ملاحظات">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
            </Field>
          </div>

          {merchant && (
            <div className="text-xs bg-background rounded-lg px-4 py-2">
              رصيد التاجر الحالي: <b className="tabular">{fmtMoney(merchant.balance)}</b> د.ع
            </div>
          )}

          {merchantId && merchantInvoices.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">تخصيص على فواتير (اختياري)</p>
                <button type="button" onClick={autoAllocate} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">
                  تخصيص تلقائي (الأقدم أولاً)
                </button>
              </div>
              <div className="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
                {merchantInvoices
                  .slice()
                  .sort((a, b) => (a.invoice_date ?? "").localeCompare(b.invoice_date ?? ""))
                  .map((inv) => (
                    <div key={inv.invoice_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <div className="flex-1">
                        <span dir="ltr" className="tabular">{inv.invoice_number}</span>
                        <span className="text-muted text-xs mr-2">{fmtDate(inv.invoice_date)}</span>
                      </div>
                      <div className="text-muted text-xs tabular">متبقّي {fmtMoney(inv.remaining)}</div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={alloc[inv.invoice_id] ?? ""}
                        onChange={(e) => setAlloc((a) => ({ ...a, [inv.invoice_id]: e.target.value }))}
                        dir="ltr"
                        className="w-28 border border-border rounded-lg px-2 py-1 outline-none focus:border-primary bg-card"
                      />
                    </div>
                  ))}
              </div>
              <div className="text-xs text-muted mt-1">
                مجموع التخصيص: <b className="tabular">{fmtMoney(allocSum)}</b>
                {" "}من {fmtMoney(Number(amount) || 0)}
                {allocSum > (Number(amount) || 0) + 0.001 && (
                  <span className="text-red-600"> — يتجاوز المبلغ!</span>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button disabled={pending} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60">
              {pending ? "جارٍ الحفظ…" : "حفظ السند"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      {children}
    </div>
  );
}
