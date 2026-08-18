import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import TasksClient, { type TaskRow, type Option } from "@/components/tasks/TasksClient";

export default async function TasksPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.tasks.view);

  const supabase = await createClient();
  const [{ data: tasks }, { data: users }, { data: merchants }, { data: products }, { data: invoices }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, description, priority, due_date, status, item_type, approval_status, approver_id, decision_note, related_type, related_id, created_by, created_at, task_assignees(user_id, user_profiles(full_name)), task_comments(id, body, created_at, user_id, user_profiles(full_name)), task_attachments(id, storage_path, file_name, file_size, created_at)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.rpc("list_active_users"),
      supabase.from("merchants").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("v_products").select("id, name, sku").eq("is_active", true).order("name"),
      supabase
        .from("sales_invoices")
        .select("id, invoice_number")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const userMap: Record<string, string> = {};
  const userOptions: Option[] = (users ?? []).map((u) => {
    userMap[u.id] = u.full_name;
    return { id: u.id, label: u.full_name };
  });

  const merchantOptions: Option[] = (merchants ?? []).map((m) => ({ id: m.id, label: m.name }));
  const productOptions: Option[] = (products ?? []).map((p) => ({
    id: p.id ?? "",
    label: `${p.name ?? ""}${p.sku ? ` (${p.sku})` : ""}`,
  }));
  const invoiceOptions: Option[] = (invoices ?? []).map((i) => ({
    id: i.id,
    label: i.invoice_number ?? i.id.slice(0, 8),
  }));

  const relatedLabel = (type: string | null, id: string | null): string | null => {
    if (!type || !id) return null;
    const src = type === "merchant" ? merchantOptions : type === "product" ? productOptions : invoiceOptions;
    return src.find((o) => o.id === id)?.label ?? null;
  };

  const rows: TaskRow[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    due_date: t.due_date,
    status: t.status,
    item_type: t.item_type,
    approval_status: t.approval_status,
    approver_id: t.approver_id,
    approver_name: t.approver_id ? (userMap[t.approver_id] ?? null) : null,
    decision_note: t.decision_note,
    related_type: t.related_type,
    related_id: t.related_id,
    related_label: relatedLabel(t.related_type, t.related_id),
    created_by: t.created_by,
    created_at: t.created_at,
    assignees: (t.task_assignees ?? []).map((a) => ({
      user_id: a.user_id,
      name: (a.user_profiles as { full_name: string | null } | null)?.full_name ?? userMap[a.user_id] ?? "—",
    })),
    comments: (t.task_comments ?? [])
      .map((c) => ({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        author: (c.user_profiles as { full_name: string | null } | null)?.full_name ?? "—",
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    attachments: (t.task_attachments ?? [])
      .map((a) => ({
        id: a.id,
        storage_path: a.storage_path,
        file_name: a.file_name,
        file_size: a.file_size,
        created_at: a.created_at,
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));

  return (
    <TasksClient
      tasks={rows}
      users={userOptions}
      merchants={merchantOptions}
      products={productOptions}
      invoices={invoiceOptions}
      currentUserId={ctx.userId}
      canCreate={ctx.permissions.has(PERMISSIONS.tasks.create)}
      canAssign={ctx.permissions.has(PERMISSIONS.tasks.assign)}
      canViewAll={ctx.permissions.has(PERMISSIONS.tasks.viewAll)}
      canRequest={ctx.permissions.has(PERMISSIONS.tasks.requestCreate)}
      canApprove={ctx.permissions.has(PERMISSIONS.tasks.requestApprove)}
    />
  );
}
