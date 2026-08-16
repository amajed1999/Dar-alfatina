"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";

export async function markRead(id: string) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false };
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllRead() {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false };
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", ctx.userId)
    .eq("is_read", false);
  revalidatePath("/notifications");
  return { ok: true };
}
