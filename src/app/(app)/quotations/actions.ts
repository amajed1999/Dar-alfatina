"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type QuoteHeader = {
  merchant_id: string;
  quote_date: string;
  valid_until: string | null;
  currency: string;
  exchange_rate: number;
  discount: number;
  notes: string | null;
};
export type QuoteItemInput = {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
};

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

function validate(h: QuoteHeader, items: QuoteItemInput[]): string | null {
  if (!h.merchant_id) return "التاجر مطلوب.";
  if (!h.quote_date) return "تاريخ العرض مطلوب.";
  const clean = items.filter((i) => i.product_id && i.quantity > 0);
  if (clean.length === 0) return "أضف بنداً واحداً على الأقل بكمية صحيحة.";
  return null;
}

async function insertItems(id: string, items: QuoteItemInput[]) {
  const supabase = await createClient();
  const rows = items
    .filter((i) => i.product_id && i.quantity > 0)
    .map((i) => ({
      quotation_id: id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount || 0,
    }));
  if (rows.length === 0) return null;
  const { error } = await supabase.from("quotation_items").insert(rows);
  return error?.message ?? null;
}

async function recalc(id: string) {
  const supabase = await createClient();
  const [{ data: items }, { data: q }] = await Promise.all([
    supabase.from("quotation_items").select("line_total").eq("quotation_id", id),
    supabase.from("quotations").select("discount").eq("id", id).single(),
  ]);
  const subtotal = (items ?? []).reduce((s, r) => s + (r.line_total ?? 0), 0);
  const total = Math.max(subtotal - (q?.discount ?? 0), 0);
  await supabase.from("quotations").update({ subtotal, total }).eq("id", id);
}

export async function saveQuotation(
  header: QuoteHeader,
  items: QuoteItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.quotationsCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإنشاء عروض الأسعار." };
  const err = validate(header, items);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .insert({
      merchant_id: header.merchant_id,
      quote_date: header.quote_date,
      valid_until: header.valid_until,
      currency: header.currency,
      exchange_rate: header.exchange_rate,
      discount: header.discount || 0,
      notes: header.notes,
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const itemsErr = await insertItems(data.id, items);
  if (itemsErr) return { ok: false, error: itemsErr };
  await recalc(data.id);

  revalidatePath("/quotations");
  return { ok: true, id: data.id };
}

export async function updateQuotation(
  id: string,
  header: QuoteHeader,
  items: QuoteItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.quotationsCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل عروض الأسعار." };
  const err = validate(header, items);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quotations")
    .update({
      merchant_id: header.merchant_id,
      quote_date: header.quote_date,
      valid_until: header.valid_until,
      currency: header.currency,
      exchange_rate: header.exchange_rate,
      discount: header.discount || 0,
      notes: header.notes,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("quotation_items").delete().eq("quotation_id", id);
  const itemsErr = await insertItems(id, items);
  if (itemsErr) return { ok: false, error: itemsErr };
  await recalc(id);

  revalidatePath("/quotations");
  return { ok: true, id };
}

export async function setQuotationStatus(id: string, status: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.quotationsCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك." };
  if (!["draft", "sent", "accepted", "rejected"].includes(status))
    return { ok: false, error: "حالة غير صحيحة." };
  const supabase = await createClient();
  const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/quotations");
  return { ok: true };
}

export async function deleteQuotation(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.quotationsCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/quotations");
  return { ok: true };
}

/** تحويل عرض السعر إلى مسودّة فاتورة بيع. */
export async function convertQuotation(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.invoiceCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإنشاء فواتير البيع." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_quotation_to_invoice", { p_quote: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/quotations");
  revalidatePath("/sales");
  return { ok: true, id: data as string };
}
