"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type SalesHeader = {
  merchant_id: string;
  warehouse_id: string;
  invoice_date: string;
  sale_type: "cash" | "credit" | "partial";
  currency: string;
  exchange_rate: number;
  discount: number;
  paid_amount: number;
  notes: string | null;
};
export type SalesItemInput = {
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

const lineTotal = (i: SalesItemInput) =>
  Math.max(i.quantity * i.unit_price - (i.discount || 0), 0);

function validate(h: SalesHeader, items: SalesItemInput[]): string | null {
  if (!h.merchant_id) return "التاجر مطلوب.";
  if (!h.warehouse_id) return "المخزن مطلوب.";
  if (!h.invoice_date) return "تاريخ الفاتورة مطلوب.";
  if (!h.exchange_rate || h.exchange_rate <= 0) return "سعر الصرف يجب أن يكون أكبر من صفر.";
  const clean = items.filter((i) => i.product_id && i.quantity > 0);
  if (clean.length === 0) return "أضف بنداً واحداً على الأقل بكمية صحيحة.";
  return null;
}

async function recalcInvoice(id: string) {
  const supabase = await createClient();
  const [{ data: items }, { data: inv }] = await Promise.all([
    supabase.from("sales_invoice_items").select("line_total").eq("sales_invoice_id", id),
    supabase.from("sales_invoices").select("discount").eq("id", id).single(),
  ]);
  const subtotal = (items ?? []).reduce((s, r) => s + (r.line_total ?? 0), 0);
  const total = Math.max(subtotal - (inv?.discount ?? 0), 0);
  await supabase.from("sales_invoices").update({ subtotal, total }).eq("id", id);
}

async function insertItems(id: string, items: SalesItemInput[]) {
  const supabase = await createClient();
  const rows = items
    .filter((i) => i.product_id && i.quantity > 0)
    .map((i) => ({
      sales_invoice_id: id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount || 0,
    }));
  if (rows.length === 0) return null;
  const { error } = await supabase.from("sales_invoice_items").insert(rows);
  return error?.message ?? null;
}

export async function saveSalesDraft(
  header: SalesHeader,
  items: SalesItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.invoiceCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإنشاء فواتير البيع." };
  const err = validate(header, items);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_invoices")
    .insert({
      merchant_id: header.merchant_id,
      warehouse_id: header.warehouse_id,
      rep_id: ctx.userId,
      invoice_date: header.invoice_date,
      sale_type: header.sale_type,
      currency: header.currency,
      exchange_rate: header.exchange_rate,
      discount: header.discount || 0,
      paid_amount: header.paid_amount || 0,
      notes: header.notes,
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const itemsErr = await insertItems(data.id, items);
  if (itemsErr) return { ok: false, error: itemsErr };
  await recalcInvoice(data.id);

  revalidatePath("/sales");
  return { ok: true, id: data.id };
}

export async function updateSalesDraft(
  id: string,
  header: SalesHeader,
  items: SalesItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.invoiceCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل فواتير البيع." };
  const err = validate(header, items);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error: upErr } = await supabase
    .from("sales_invoices")
    .update({
      merchant_id: header.merchant_id,
      warehouse_id: header.warehouse_id,
      invoice_date: header.invoice_date,
      sale_type: header.sale_type,
      currency: header.currency,
      exchange_rate: header.exchange_rate,
      discount: header.discount || 0,
      paid_amount: header.paid_amount || 0,
      notes: header.notes,
    })
    .eq("id", id)
    .eq("status", "draft");
  if (upErr) return { ok: false, error: upErr.message };

  await supabase.from("sales_invoice_items").delete().eq("sales_invoice_id", id);
  const itemsErr = await insertItems(id, items);
  if (itemsErr) return { ok: false, error: itemsErr };
  await recalcInvoice(id);

  revalidatePath("/sales");
  return { ok: true, id };
}

/** اعتماد فاتورة البيع: خصم المخزون + تثبيت COGS + فحص الائتمان (ذرّي في قاعدة البيانات). */
export async function approveSale(
  id: string,
  overrideCredit = false,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.invoiceApprove);
  if (!ctx) return { ok: false, error: "غير مصرح لك باعتماد فواتير البيع." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_sales_invoice", {
    p_invoice_id: id,
    p_override_credit: overrideCredit,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/merchants");
  return { ok: true };
}

export async function discardSale(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.invoiceCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك بحذف فواتير البيع." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sales");
  return { ok: true };
}

// ============================ مرتجعات البيع ============================

export type ReturnHeader = {
  merchant_id: string;
  warehouse_id: string;
  original_invoice_id: string | null;
  return_date: string;
  notes: string | null;
};
export type ReturnItemInput = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

export async function saveReturnDraft(
  header: ReturnHeader,
  items: ReturnItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.returnCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإنشاء مرتجعات." };
  if (!header.merchant_id) return { ok: false, error: "التاجر مطلوب." };
  if (!header.warehouse_id) return { ok: false, error: "المخزن مطلوب." };
  const clean = items.filter((i) => i.product_id && i.quantity > 0);
  if (clean.length === 0) return { ok: false, error: "أضف بنداً واحداً على الأقل." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_returns")
    .insert({
      merchant_id: header.merchant_id,
      warehouse_id: header.warehouse_id,
      original_invoice_id: header.original_invoice_id,
      return_date: header.return_date,
      notes: header.notes,
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const rows = clean.map((i) => ({
    sales_return_id: data.id,
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: i.unit_price,
  }));
  const { error: itErr } = await supabase.from("sales_return_items").insert(rows);
  if (itErr) return { ok: false, error: itErr.message };

  const subtotal = clean.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  await supabase
    .from("sales_returns")
    .update({ subtotal, total: subtotal })
    .eq("id", data.id);

  revalidatePath("/sales");
  return { ok: true, id: data.id };
}

export async function approveReturn(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.returnCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك باعتماد المرتجعات." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_sales_return", { p_return_id: id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/merchants");
  return { ok: true };
}

export async function discardReturn(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.sales.returnCreate);
  if (!ctx) return { ok: false, error: "غير مصرح لك بحذف المرتجعات." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_returns")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sales");
  return { ok: true };
}
