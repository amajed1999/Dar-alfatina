"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string };

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

async function onHand(
  productId: string,
  warehouseId: string,
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_stock_by_warehouse")
    .select("qty")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();
  return data?.qty ?? 0;
}

/**
 * تسوية جرد: كمية موقّعة (+ إدخال / − إخراج).
 * تُستخدم لمطابقة النظام مع الجرد الفعلي.
 */
export async function recordAdjustment(input: {
  product_id: string;
  warehouse_id: string;
  quantity: number; // signed
  notes: string;
}): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.inventory.adjust);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتسوية الجرد." };
  if (!input.product_id || !input.warehouse_id)
    return { ok: false, error: "المنتج والمخزن مطلوبان." };
  if (!input.quantity || input.quantity === 0)
    return { ok: false, error: "الكمية يجب ألا تساوي صفراً." };
  if (input.quantity < 0) {
    const oh = await onHand(input.product_id, input.warehouse_id);
    if (oh + input.quantity < 0)
      return {
        ok: false,
        error: `الرصيد الحالي (${oh}) لا يسمح بخصم هذه الكمية.`,
      };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id: input.product_id,
    warehouse_id: input.warehouse_id,
    movement_type: "adjustment",
    quantity: input.quantity,
    reference_type: "adjustment",
    notes: input.notes.trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/products");
  return { ok: true };
}

/** تسجيل تالف: كمية موجبة تُخرَج من المخزون. */
export async function recordDamage(input: {
  product_id: string;
  warehouse_id: string;
  quantity: number; // positive magnitude
  notes: string;
}): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.inventory.movement);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتسجيل التالف." };
  if (!input.product_id || !input.warehouse_id)
    return { ok: false, error: "المنتج والمخزن مطلوبان." };
  if (!input.quantity || input.quantity <= 0)
    return { ok: false, error: "الكمية يجب أن تكون أكبر من صفر." };

  const oh = await onHand(input.product_id, input.warehouse_id);
  if (oh < input.quantity)
    return {
      ok: false,
      error: `الرصيد المتاح (${oh}) لا يكفي لتسجيل هذا التالف.`,
    };

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id: input.product_id,
    warehouse_id: input.warehouse_id,
    movement_type: "damage",
    quantity: -Math.abs(input.quantity),
    reference_type: "damage",
    notes: input.notes.trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/products");
  return { ok: true };
}

/** تحويل بين مخزنين (ذرّي عبر دالة قاعدة البيانات). */
export async function transferStock(input: {
  product_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  quantity: number;
  notes: string;
}): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.inventory.transfer);
  if (!ctx) return { ok: false, error: "غير مصرح لك بالتحويل بين المخازن." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_transfer", {
    p_product: input.product_id,
    p_from: input.from_warehouse_id,
    p_to: input.to_warehouse_id,
    p_qty: input.quantity,
    p_notes: input.notes.trim() || undefined,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}
