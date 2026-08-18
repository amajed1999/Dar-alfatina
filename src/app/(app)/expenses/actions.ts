"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type ExpensePayload = {
  category_id: string | null;
  amount: number;
  expense_date: string;
  description: string | null;
  payment_method: "cash" | "transfer" | "cheque" | null;
  notes: string | null;
};

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

export async function createExpense(payload: ExpensePayload): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.expenses.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتسجيل المصاريف." };
  if (!payload.amount || payload.amount <= 0)
    return { ok: false, error: "المبلغ يجب أن يكون أكبر من صفر." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      category_id: payload.category_id,
      amount: payload.amount,
      expense_date: payload.expense_date,
      description: payload.description,
      payment_method: payload.payment_method,
      notes: payload.notes,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/expenses");
  revalidatePath("/reports/profit");
  return { ok: true, id: data.id };
}

export async function updateExpense(
  id: string,
  payload: ExpensePayload,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.expenses.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل المصاريف." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      category_id: payload.category_id,
      amount: payload.amount,
      expense_date: payload.expense_date,
      description: payload.description,
      payment_method: payload.payment_method,
      notes: payload.notes,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/expenses");
  revalidatePath("/reports/profit");
  return { ok: true, id };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.expenses.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بحذف المصاريف." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/expenses");
  revalidatePath("/reports/profit");
  return { ok: true };
}

/** اعتماد/رفض مصروف معلّق (يتطلب صلاحية expenses.approve). */
export async function decideExpense(
  id: string,
  approve: boolean,
  note: string | null,
): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.expenses.approve);
  if (!ctx) return { ok: false, error: "غير مصرح لك باعتماد المصاريف." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_expense", {
    p_id: id,
    p_approve: approve,
    p_note: note,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/reports/profit");
  return { ok: true };
}

export async function createExpenseCategory(name: string): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.expenses.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك." };
  const n = name.trim();
  if (!n) return { ok: false, error: "اسم التصنيف مطلوب." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ name: n })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/expenses");
  return { ok: true, id: data.id };
}
