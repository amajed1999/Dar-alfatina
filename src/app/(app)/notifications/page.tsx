import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import NotificationsClient, { type NotifRow } from "@/components/notifications/NotificationsClient";

export default async function NotificationsPage() {
  const ctx = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: NotifRow[] = (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    is_read: n.is_read,
    created_at: n.created_at,
  }));

  return <NotificationsClient notifications={rows} />;
}
