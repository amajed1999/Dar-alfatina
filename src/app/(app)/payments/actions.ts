"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type PaymentInput = {
  merchant_id: string;
  amount: number;
  method: "cash" | "transfer" | "cheque";
  payment_date: string;
  reference_no: string | null;
  notes: string | null;
  allocations: { invoice_id: string; amount: number }[];
};

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

export async function recordPayment(input: PaymentInput): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.payments.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتسجيل التحصيلات." };
  if (!input.merchant_id) return { ok: false, error: "التاجر مطلوب." };
  if (!input.amount || input.amount <= 0)
    return { ok: false, error: "المبلغ يجب أن يكون أكبر من صفر." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", {
    p_merchant: input.merchant_id,
    p_amount: input.amount,
    p_method: input.method,
    p_date: input.payment_date,
    p_rep: ctx.userId,
    p_reference: input.reference_no,
    p_notes: input.notes,
    p_currency: "IQD",
    p_rate: 1,
    p_allocations: input.allocations
      .filter((a) => a.invoice_id && a.amount > 0)
      .map((a) => ({ invoice_id: a.invoice_id, amount: a.amount })),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/payments");
  revalidatePath("/merchants");
  revalidatePath("/reports/aging");
  return { ok: true };
}

export async function voidPayment(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.payments.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإلغاء التحصيلات." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("settlement_id", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/payments");
  revalidatePath("/merchants");
  return { ok: true };
}

export async function settleCustody(
  repId: string,
  paymentIds: string[],
  date: string,
  notes: string | null,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.payments.custody);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتسوية العهدة." };
  if (paymentIds.length === 0)
    return { ok: false, error: "اختر سندات القبض المراد تسليمها." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_rep_custody", {
    p_rep: repId,
    p_payment_ids: paymentIds,
    p_date: date,
    p_notes: notes,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/payments");
  return { ok: true };
}
