"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type SupplierPayload = {
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

async function guard() {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(PERMISSIONS.purchases.create)) return null;
  return ctx;
}

export async function createSupplier(
  payload: SupplierPayload,
): Promise<ActionResult> {
  const ctx = await guard();
  if (!ctx) return { ok: false, error: "غير مصرح لك بإدارة الموردين." };
  if (!payload.name.trim()) return { ok: false, error: "اسم المورد مطلوب." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: payload.name.trim(),
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes,
      is_active: payload.is_active,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  return { ok: true, id: data.id };
}

export async function updateSupplier(
  id: string,
  payload: SupplierPayload,
): Promise<ActionResult> {
  const ctx = await guard();
  if (!ctx) return { ok: false, error: "غير مصرح لك بإدارة الموردين." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: payload.name.trim(),
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes,
      is_active: payload.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  return { ok: true, id };
}

export async function setSupplierActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const ctx = await guard();
  if (!ctx) return { ok: false, error: "غير مصرح لك بإدارة الموردين." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  return { ok: true };
}
