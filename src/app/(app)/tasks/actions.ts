"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string; id?: string };

export type TaskInput = {
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  related_type: "merchant" | "sales_invoice" | "product" | null;
  related_id: string | null;
  assignees: string[];
};

async function ctxWith(perm: string) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(perm)) return null;
  return ctx;
}

export async function createTask(input: TaskInput): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.tasks.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بإنشاء المهام." };
  if (!input.title.trim()) return { ok: false, error: "عنوان المهمة مطلوب." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_task", {
    p_title: input.title.trim(),
    p_description: input.description,
    p_priority: input.priority,
    p_due_date: input.due_date,
    p_related_type: input.related_type,
    p_related_id: input.related_id,
    p_assignees: input.assignees.length ? input.assignees : [ctx.userId],
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true, id: data as string };
}

export async function updateTask(id: string, input: TaskInput): Promise<ActionResult> {
  const ctx = await ctxWith(PERMISSIONS.tasks.create);
  if (!ctx) return { ok: false, error: "غير مصرح لك بتعديل المهام." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task", {
    p_task_id: id,
    p_title: input.title.trim(),
    p_description: input.description,
    p_priority: input.priority,
    p_due_date: input.due_date,
    p_related_type: input.related_type,
    p_related_id: input.related_id,
    p_assignees: input.assignees.length ? input.assignees : [ctx.userId],
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true, id };
}

export async function changeStatus(id: string, status: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "غير مصرح." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_status", { p_task_id: id, p_status: status });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

export async function addComment(taskId: string, body: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "غير مصرح." };
  if (!body.trim()) return { ok: false, error: "التعليق فارغ." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_task_comment", { p_task_id: taskId, p_body: body.trim() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

export async function removeTask(id: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "غير مصرح." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_task", { p_task_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

// ---------------- المرفقات ----------------
// الرفع الفعلي للملف يتم من المتصفح إلى التخزين؛ هذه تسجّل البيانات الوصفية.
export async function addAttachment(
  taskId: string,
  storagePath: string,
  fileName: string,
  fileSize: number,
  mimeType: string | null,
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "غير مصرح." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    storage_path: storagePath,
    file_name: fileName,
    file_size: fileSize,
    mime_type: mimeType,
    uploaded_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

export async function removeAttachment(
  id: string,
  storagePath: string,
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "غير مصرح." };

  const supabase = await createClient();
  await supabase.storage.from("task-attachments").remove([storagePath]);
  const { error } = await supabase.from("task_attachments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}
