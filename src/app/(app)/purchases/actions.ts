"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type PurchaseHeader = {
  supplier_id: string | null;
  warehouse_id: string;
  invoice_date: string;
  currency: string;
  exchange_rate: number;
  discount: number;
  notes: string | null;
};

export type PurchaseItemInput = {
  product_id: string;
  quantity: number;
  unit_cost: number;
  discount: number;
};

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

function lineTotal(it: PurchaseItemInput): number {
  return Math.max(it.quantity * it.unit_cost - (it.discount || 0), 0);
}

function validate(header: PurchaseHeader, items: PurchaseItemInput[]): string | null {
  if (!header.warehouse_id) return "المخزن مطلوب.";
  if (!header.invoice_date) return "تاريخ الفاتورة مطلوب.";
  if (!header.exchange_rate || header.exchange_rate <= 0)
    return "سعر الصرف يجب أن يكون أكبر من صفر.";
  const clean = items.filter((i) => i.product_id && i.quantity > 0);
  if (clean.length === 0) return "أضف بنداً واحداً على الأقل بكمية صحيحة.";
  for (const i of clean) {
    if (i.unit_cost < 0) return "تكلفة الوحدة لا يمكن أن تكون سالبة.";
  }
  return null;
}

async function recalc(invoiceId: string) {
  const supabase = await createClient();
  const [{ data: items }, { data: inv }] = await Promise.all([
    supabase
      .from("purchase_invoice_items")
      .select("line_total")
      .eq("purchase_invoice_id", invoiceId),
    supabase
      .from("purchase_invoices")
      .select("discount")
      .eq("id", invoiceId)
      .single(),
  ]);
  const subtotal = (items ?? []).reduce((s, r) => s + (r.line_total ?? 0), 0);
  const total = Math.max(subtotal - (inv?.discount ?? 0), 0);
  await supabase
    .from("purchase_invoices")
    .update({ subtotal, total })
    .eq("id", invoiceId);
}

async function insertItems(invoiceId: string, items: PurchaseItemInput[]) {
  const supabase = await createClient();
  const rows = items
    .filter((i) => i.product_id && i.quantity > 0)
    .map((i) => ({
      purchase_invoice_id: invoiceId,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      discount: i.discount || 0,
      line_total: lineTotal(i),
    }));
  if (rows.length === 0) return null;
  const { error } = await supabase.from("purchase_invoice_items").insert(rows);
  return error?.message ?? null;
}

/** إنشاء فاتورة شراء مسودّة مع بنودها. */
export async function savePurchaseDraft(
  header: PurchaseHeader,
  items: PurchaseItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.purchases.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإنشاء فواتير الشراء." };
  const err = validate(header, items);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_invoices")
    .insert({
      supplier_id: header.supplier_id,
      warehouse_id: header.warehouse_id,
      invoice_date: header.invoice_date,
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

  revalidatePath("/purchases");
  return { ok: true, id: data.id };
}

/** تعديل مسودّة (استبدال البنود بالكامل). المعتمدة لا تُعدَّل. */
export async function updatePurchaseDraft(
  id: string,
  header: PurchaseHeader,
  items: PurchaseItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.purchases.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل فواتير الشراء." };
  const err = validate(header, items);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error: upErr } = await supabase
    .from("purchase_invoices")
    .update({
      supplier_id: header.supplier_id,
      warehouse_id: header.warehouse_id,
      invoice_date: header.invoice_date,
      currency: header.currency,
      exchange_rate: header.exchange_rate,
      discount: header.discount || 0,
      notes: header.notes,
    })
    .eq("id", id)
    .eq("status", "draft");
  if (upErr) return { ok: false, error: upErr.message };

  await supabase
    .from("purchase_invoice_items")
    .delete()
    .eq("purchase_invoice_id", id);
  const itemsErr = await insertItems(id, items);
  if (itemsErr) return { ok: false, error: itemsErr };
  await recalc(id);

  revalidatePath("/purchases");
  return { ok: true, id };
}

/** اعتماد الفاتورة: يخصم المخزون ويثبّت التكلفة (متوسط مرجّح) داخل معاملة واحدة. */
export async function approvePurchase(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.purchases.approve);
  if (!ctx) return { ok: false, error: "غير مصرح لك باعتماد فواتير الشراء." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_purchase_invoice", {
    p_invoice_id: id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/products");
  return { ok: true };
}

/** حذف مسودّة (حذف منطقي). المعتمدة لا تُحذف. */
export async function discardPurchase(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.purchases.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك بحذف فواتير الشراء." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/purchases");
  return { ok: true };
}
