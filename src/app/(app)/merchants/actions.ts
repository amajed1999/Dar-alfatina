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

export type VisitInput = {
  merchant_id: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  outcome: "order" | "collection" | "follow_up" | "no_order" | "other";
  notes: string | null;
};

/** تسجيل زيارة ميدانية لتاجر مع الموقع (GPS). */
export async function logVisit(input: VisitInput): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.merchants.visit);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتسجيل الزيارات." };
  if (!input.merchant_id) return { ok: false, error: "التاجر مطلوب." };

  const supabase = await createClient();
  const { error } = await supabase.from("merchant_visits").insert({
    merchant_id: input.merchant_id,
    rep_id: ctx.userId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    outcome: input.outcome,
    notes: input.notes,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/visits");
  revalidatePath("/reports/reps");
  return { ok: true };
}

/** ربط حساب بوابة لتاجر (بالبريد — يجب أن يكون التاجر قد سجّل حساباً أولاً). */
export async function linkPortal(merchantId: string, email: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.merchants.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك." };
  if (!email.trim()) return { ok: false, error: "البريد مطلوب." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("link_merchant_portal", {
    p_merchant: merchantId,
    p_email: email.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/merchants");
  return { ok: true };
}

export async function unlinkPortal(merchantId: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.merchants.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_merchant_portal", { p_merchant: merchantId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/merchants");
  return { ok: true };
}

/** إنشاء حساب بوابة جديد لتاجر (إيميل+كلمة مرور) وربطه دفعة واحدة. للمدير فقط. */
export async function createMerchantUser(
  merchantId: string,
  email: string,
  password: string,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.merchants.edit);
  if (!ctx) return { ok: false, error: "غير مصرح لك." };
  if (!email.trim()) return { ok: false, error: "البريد مطلوب." };
  if (password.length < 8) return { ok: false, error: "كلمة المرور 8 أحرف على الأقل." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_merchant_user", {
    p_merchant_id: merchantId,
    p_email: email.trim(),
    p_password: password,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/merchants");
  return { ok: true };
}
