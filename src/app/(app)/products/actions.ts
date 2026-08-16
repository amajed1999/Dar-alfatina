"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type ProductPayload = {
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  base_unit_id: string | null;
  pack_unit_id: string | null;
  units_per_pack: number | null;
  reorder_level: number;
  has_expiry: boolean;
  is_active: boolean;
  prices: { price_tier_id: string; price: number }[];
};

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

export async function createProduct(
  payload: ProductPayload,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.products.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإضافة منتجات." };
  if (!payload.name.trim() || !payload.sku.trim())
    return { ok: false, error: "الاسم والرمز (SKU) مطلوبان." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: payload.name.trim(),
      sku: payload.sku.trim(),
      barcode: payload.barcode,
      category_id: payload.category_id,
      base_unit_id: payload.base_unit_id,
      pack_unit_id: payload.pack_unit_id,
      units_per_pack: payload.units_per_pack,
      reorder_level: payload.reorder_level,
      has_expiry: payload.has_expiry,
      is_active: payload.is_active,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  if (ctx.permissions.has(PERMISSIONS.products.viewPrices)) {
    await savePrices(data.id, payload.prices);
  }
  revalidatePath("/products");
  return { ok: true, id: data.id };
}

export async function updateProduct(
  id: string,
  payload: ProductPayload,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.products.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل المنتجات." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: payload.name.trim(),
      sku: payload.sku.trim(),
      barcode: payload.barcode,
      category_id: payload.category_id,
      base_unit_id: payload.base_unit_id,
      pack_unit_id: payload.pack_unit_id,
      units_per_pack: payload.units_per_pack,
      reorder_level: payload.reorder_level,
      has_expiry: payload.has_expiry,
      is_active: payload.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  if (ctx.permissions.has(PERMISSIONS.products.viewPrices)) {
    await savePrices(id, payload.prices);
  }
  revalidatePath("/products");
  return { ok: true, id };
}

async function savePrices(
  productId: string,
  prices: { price_tier_id: string; price: number }[],
) {
  const supabase = await createClient();
  const rows = prices
    .filter((p) => p.price_tier_id)
    .map((p) => ({
      product_id: productId,
      price_tier_id: p.price_tier_id,
      price: p.price,
    }));
  if (rows.length === 0) return;
  await supabase
    .from("product_prices")
    .upsert(rows, { onConflict: "product_id,price_tier_id" });
}

/** إنشاء تصنيف جديد (سريع من داخل نموذج المنتج) */
export async function createCategory(name: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.products.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإضافة تصنيفات." };
  const n = name.trim();
  if (!n) return { ok: false, error: "اسم التصنيف مطلوب." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: n, created_by: ctx.userId })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/products");
  return { ok: true, id: data.id };
}

/** تفعيل/إيقاف منتج (لا حذف فعلي للسجلات) */
export async function setProductActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.products.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل المنتجات." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/products");
  return { ok: true };
}
