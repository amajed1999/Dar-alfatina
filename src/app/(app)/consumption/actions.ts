"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type ConsumptionHeader = {
  warehouse_id: string;
  note_date: string;
  reason_type: "sample" | "gift" | "damage" | "internal" | "other";
  reason: string;
  notes: string | null;
};
export type ConsumptionItemInput = { product_id: string; quantity: number };

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

function validate(h: ConsumptionHeader, items: ConsumptionItemInput[]): string | null {
  if (!h.warehouse_id) return "المخزن مطلوب.";
  if (!h.reason.trim()) return "السبب مطلوب.";
  if (items.filter((i) => i.product_id && i.quantity > 0).length === 0)
    return "أضف بنداً واحداً على الأقل.";
  return null;
}

async function insertItems(id: string, items: ConsumptionItemInput[]) {
  const supabase = await createClient();
  const rows = items
    .filter((i) => i.product_id && i.quantity > 0)
    .map((i) => ({ consumption_note_id: id, product_id: i.product_id, quantity: i.quantity }));
  if (rows.length === 0) return null;
  const { error } = await supabase.from("consumption_note_items").insert(rows);
  return error?.message ?? null;
}

export async function saveConsumptionDraft(
  header: ConsumptionHeader,
  items: ConsumptionItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.consumption.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإنشاء قوائم استهلاك." };
  const err = validate(header, items);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consumption_notes")
    .insert({
      warehouse_id: header.warehouse_id,
      note_date: header.note_date,
      reason_type: header.reason_type,
      reason: header.reason.trim(),
      notes: header.notes,
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const itErr = await insertItems(data.id, items);
  if (itErr) return { ok: false, error: itErr };

  revalidatePath("/consumption");
  return { ok: true, id: data.id };
}

export async function updateConsumptionDraft(
  id: string,
  header: ConsumptionHeader,
  items: ConsumptionItemInput[],
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.consumption.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل قوائم الاستهلاك." };
  const err = validate(header, items);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error: upErr } = await supabase
    .from("consumption_notes")
    .update({
      warehouse_id: header.warehouse_id,
      note_date: header.note_date,
      reason_type: header.reason_type,
      reason: header.reason.trim(),
      notes: header.notes,
    })
    .eq("id", id)
    .eq("status", "draft");
  if (upErr) return { ok: false, error: upErr.message };

  await supabase.from("consumption_note_items").delete().eq("consumption_note_id", id);
  const itErr = await insertItems(id, items);
  if (itErr) return { ok: false, error: itErr };

  revalidatePath("/consumption");
  return { ok: true, id };
}

export async function approveConsumption(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.consumption.approve);
  if (!ctx) return { ok: false, error: "غير مصرح لك باعتماد قوائم الاستهلاك." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_consumption_note", { p_note_id: id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/consumption");
  revalidatePath("/inventory");
  revalidatePath("/reports/profit");
  return { ok: true };
}

export async function discardConsumption(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.consumption.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بحذف قوائم الاستهلاك." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("consumption_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/consumption");
  return { ok: true };
}
