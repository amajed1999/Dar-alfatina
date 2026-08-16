"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type MerchantPayload = {
  name: string;
  shop_name: string | null;
  phone: string | null;
  province: string | null;
  address: string | null;
  credit_limit: number;
  price_tier_id: string | null;
  assigned_rep: string | null;
  status: "active" | "suspended";
  notes: string | null;
};

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

export async function createMerchant(
  payload: MerchantPayload,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.merchants.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإضافة تجار." };
  if (!payload.name.trim()) return { ok: false, error: "اسم التاجر مطلوب." };

  // مندوب بلا صلاحية رؤية الكل: التاجر يُسند إليه إجبارياً
  const canAssignOthers = ctx.permissions.has(PERMISSIONS.merchants.viewAll);
  const assigned_rep = canAssignOthers ? payload.assigned_rep : ctx.userId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merchants")
    .insert({
      name: payload.name.trim(),
      shop_name: payload.shop_name,
      phone: payload.phone,
      province: payload.province,
      address: payload.address,
      credit_limit: payload.credit_limit,
      price_tier_id: payload.price_tier_id,
      assigned_rep,
      status: payload.status,
      notes: payload.notes,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/merchants");
  return { ok: true, id: data.id };
}

export async function updateMerchant(
  id: string,
  payload: MerchantPayload,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.merchants.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل التجار." };

  const canAssignOthers = ctx.permissions.has(PERMISSIONS.merchants.viewAll);
  const supabase = await createClient();

  const base = {
    name: payload.name.trim(),
    shop_name: payload.shop_name,
    phone: payload.phone,
    province: payload.province,
    address: payload.address,
    credit_limit: payload.credit_limit,
    price_tier_id: payload.price_tier_id,
    status: payload.status,
    notes: payload.notes,
  };
  // إعادة الإسناد لمندوب آخر تتطلب صلاحية رؤية الكل (مدير المبيعات)
  const update = canAssignOthers
    ? { ...base, assigned_rep: payload.assigned_rep }
    : base;

  const { error } = await supabase.from("merchants").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/merchants");
  return { ok: true, id };
}

export async function setMerchantStatus(
  id: string,
  status: "active" | "suspended",
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.merchants.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل التجار." };

  const supabase = await createClient();
  const { error } = await supabase.from("merchants").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/merchants");
  return { ok: true };
}
