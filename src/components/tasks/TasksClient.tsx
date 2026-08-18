"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  createTask,
  updateTask,
  createRequest,
  decideRequest,
  changeStatus,
  addComment,
  removeTask,
  addAttachment,
  removeAttachment,
  type TaskInput,
} from "@/app/(app)/tasks/actions";
import { createClient } from "@/lib/supabase/client";

export type Option = { id: string; label: string };
type Assignee = { user_id: string; name: string };
type Comment = { id: string; body: string; created_at: string; author: string };
type Attachment = {
  id: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
};
export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  item_type: string;
  approval_status: string | null;
  approver_id: string | null;
  approver_name: string | null;
  decision_note: string | null;
  related_type: string | null;
  related_id: string | null;
  related_label: string | null;
  created_by: string | null;
  created_at: string;
  assignees: Assignee[];
  comments: Comment[];
  attachments: Attachment[];
};

type Props = {
  tasks: TaskRow[];
  users: Option[];
  merchants: Option[];
  products: Option[];
  invoices: Option[];
  currentUserId: string;
  canCreate: boolean;
  canAssign: boolean;
  canViewAll: boolean;
  canRequest: boolean;
  canApprove: boolean;
};

const PRIORITY: Record<string, { label: string; cls: string }> = {
  low: { label: "منخفضة", cls: "bg-border text-muted" },
  medium: { label: "متوسطة", cls: "bg-blue-50 text-blue-700" },
  high: { label: "عالية", cls: "bg-amber-50 text-amber-700" },
  urgent: { label: "عاجلة", cls: "bg-red-50 text-red-700" },
};
const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "جديدة", cls: "bg-blue-50 text-blue-700" },
  in_progress: { label: "قيد التنفيذ", cls: "bg-amber-50 text-amber-700" },
  done: { label: "منجزة", cls: "bg-green-50 text-green-700" },
  rejected: { label: "مرفوضة", cls: "bg-red-50 text-red-700" },
  deferred: { label: "مؤجلة", cls: "bg-border text-muted" },
};
const APPROVAL: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد الموافقة", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "تمت الموافقة", cls: "bg-green-50 text-green-700" },
  rejected: { label: "مرفوض", cls: "bg-red-50 text-red-700" },
};
const BOARD_COLUMNS: { key: string; label: string; cls: string }[] = [
  { key: "new", label: "جديدة", cls: "bg-blue-50 text-blue-700" },
  { key: "in_progress", label: "قيد التنفيذ", cls: "bg-amber-50 text-amber-700" },
  { key: "deferred", label: "مؤجلة", cls: "bg-border text-muted" },
  { key: "done", label: "منجزة", cls: "bg-green-50 text-green-700" },
  { key: "rejected", label: "مرفوضة", cls: "bg-red-50 text-red-700" },
];
const REL_LABEL: Record<string, string> = { merchant: "تاجر", sales_invoice: "فاتورة", product: "منتج" };
const today = () => new Date().toISOString().slice(0, 10);

type FormState = {
  title: string;
  description: string;
  priority: TaskInput["priority"];
  due_date: string;
  related_type: "" | "merchant" | "sales_invoice" | "product";
  related_id: string;
  assignees: string[];
  approver: string;
};

export default function TasksClient({
  tasks, users, merchants, products, invoices,
  currentUserId, canCreate, canAssign, canViewAll, canRequest, canApprove,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mine" | "created" | "await">("all");
  const [mode, setMode] = useState<"task" | "request">("task");
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [view, setView] = useState<"list" | "board">("list");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(currentUserId));

  function emptyForm(self: string): FormState {
    return {
      title: "", description: "", priority: "medium", due_date: "",
      related_type: "", related_id: "", assignees: [self], approver: "",
    };
  }

  const relatedOptions = (type: string): Option[] =>
    type === "merchant" ? merchants : type === "product" ? products : type === "sales_invoice" ? invoices : [];

  const filtered = useMemo(() => {
    if (filter === "mine")
      return tasks.filter(
        (t) => t.assignees.some((a) => a.user_id === currentUserId) || t.approver_id === currentUserId,
      );
    if (filter === "created") return tasks.filter((t) => t.created_by === currentUserId);
    if (filter === "await")
      return tasks.filter(
        (t) => t.item_type === "request" && t.approval_status === "pending" && t.approver_id === currentUserId,
      );
    return tasks;
  }, [tasks, filter, currentUserId]);

  const awaitingCount = useMemo(
    () =>
      tasks.filter(
        (t) => t.item_type === "request" && t.approval_status === "pending" && t.approver_id === currentUserId,
      ).length,
    [tasks, currentUserId],
  );

  const summary = useMemo(() => {
    const onlyTasks = tasks.filter((t) => t.item_type !== "request");
    const s = { total: onlyTasks.length, open: 0, overdue: 0, done: 0 };
    const td = today();
    for (const t of onlyTasks) {
      if (t.status === "done") s.done++;
      else if (t.status === "rejected") {
        // مرفوضة = مغلقة، لا تُحسب ضمن المفتوحة
      } else {
        s.open++;
        if (t.due_date && t.due_date < td) s.overdue++;
      }
    }
    return s;
  }, [tasks]);

  function openNew() {
    setEditingId(null);
    setMode("task");
    setForm(emptyForm(currentUserId));
    setError(null);
    setOpen(true);
  }
  function openNewRequest() {
    setEditingId(null);
    setMode("request");
    setForm(emptyForm(currentUserId));
    setError(null);
    setOpen(true);
  }
  function openEdit(t: TaskRow) {
    setEditingId(t.id);
    setMode("task");
    setError(null);
    setForm({
      title: t.title,
      description: t.description ?? "",
      priority: t.priority as TaskInput["priority"],
      due_date: t.due_date ?? "",
      related_type: (t.related_type ?? "") as FormState["related_type"],
      related_id: t.related_id ?? "",
      assignees: t.assignees.map((a) => a.user_id),
      approver: "",
    });
    setOpen(true);
  }

  function toggleAssignee(uid: string) {
    setForm((f) => ({
      ...f,
      assignees: f.assignees.includes(uid)
        ? f.assignees.filter((x) => x !== uid)
        : [...f.assignees, uid],
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError(mode === "request" ? "عنوان الطلب مطلوب." : "عنوان المهمة مطلوب.");
    if (mode === "request" && !form.approver) return setError("حدّد الشخص المسؤول عن الموافقة.");

    startTransition(async () => {
      let res;
      if (mode === "request") {
        res = await createRequest({
          title: form.title,
          description: form.description.trim() || null,
          priority: form.priority,
          due_date: form.due_date || null,
          related_type: form.related_type || null,
          related_id: form.related_type ? form.related_id || null : null,
          approver: form.approver,
        });
      } else {
        const input: TaskInput = {
          title: form.title,
          description: form.description.trim() || null,
          priority: form.priority,
          due_date: form.due_date || null,
          related_type: form.related_type || null,
          related_id: form.related_type ? form.related_id || null : null,
          assignees: form.assignees.length ? form.assignees : [currentUserId],
        };
        res = editingId ? await updateTask(editingId, input) : await createTask(input);
      }
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function decide(t: TaskRow, approve: boolean) {
    setRowError(null);
    let note: string | null = null;
    if (!approve) {
      note = window.prompt("سبب الرفض (اختياري):") ?? null;
    }
    startTransition(async () => {
      const res = await decideRequest(t.id, approve, note);
      if (!res.ok) setRowError(res.error ?? "تعذّر تنفيذ القرار");
      else router.refresh();
    });
  }

  function setStatus(t: TaskRow, status: string) {
    setRowError(null);
    startTransition(async () => {
      const res = await changeStatus(t.id, status);
      if (!res.ok) setRowError(res.error ?? "تعذّر التحديث");
      else router.refresh();
    });
  }

  // نقل بطاقة في اللوحة: تحديث تفاؤلي فوري ثم الدالة الآمنة
  function moveTask(id: string, status: string) {
    const t = tasks.find((x) => x.id === id);
    const current = statusOverrides[id] ?? t?.status;
    if (!t || current === status) return;
    setRowError(null);
    setStatusOverrides((o) => ({ ...o, [id]: status }));
    startTransition(async () => {
      const res = await changeStatus(id, status);
      if (!res.ok) {
        setRowError(res.error ?? "تعذّر نقل المهمة");
        setStatusOverrides((o) => {
          const n = { ...o };
          delete n[id];
          return n;
        });
      } else {
        router.refresh();
      }
    });
  }
  function submitComment(t: TaskRow) {
    const body = (commentText[t.id] ?? "").trim();
    if (!body) return;
    startTransition(async () => {
      const res = await addComment(t.id, body);
      if (!res.ok) setRowError(res.error ?? "تعذّر إضافة التعليق");
      else {
        setCommentText((c) => ({ ...c, [t.id]: "" }));
        router.refresh();
      }
    });
  }
  function doDelete(t: TaskRow) {
    if (!confirm(`حذف المهمة «${t.title}»؟`)) return;
    startTransition(async () => {
      const res = await removeTask(t.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الحذف");
      else router.refresh();
    });
  }

  async function onUpload(t: TaskRow, file: File) {
    setRowError(null);
    setUploadingId(t.id);
    try {
      const supabase = createClient();
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const path = `${t.id}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
      const { error: upErr } = await supabase.storage
        .from("task-attachments")
        .upload(path, file, { upsert: false });
      if (upErr) {
        setRowError(upErr.message);
        return;
      }
      const res = await addAttachment(t.id, path, file.name, file.size, file.type || null);
      if (!res.ok) setRowError(res.error ?? "تعذّر تسجيل المرفق");
      else router.refresh();
    } catch {
      setRowError("تعذّر رفع الملف.");
    } finally {
      setUploadingId(null);
    }
  }

  async function onDownload(a: Attachment) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(a.storage_path, 120, { download: a.file_name });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else setRowError("تعذّر فتح الملف.");
  }

  function onRemoveAttachment(a: Attachment) {
    if (!confirm(`حذف المرفق «${a.file_name}»؟`)) return;
    startTransition(async () => {
      const res = await removeAttachment(a.id, a.storage_path);
      if (!res.ok) setRowError(res.error ?? "تعذّر حذف المرفق");
      else router.refresh();
    });
  }

  const fmtSize = (n: number | null) =>
    n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المهام</h1>
          <p className="text-muted mt-1 text-sm">إسناد المهام ومتابعتها، مع ربطها بالتجار والفواتير والمنتجات.</p>
        </div>
        <div className="flex gap-2">
          {canRequest && (
            <button onClick={openNewRequest} className="border border-primary text-primary hover:bg-primary/5 rounded-lg py-2.5 px-5 text-sm font-medium transition">
              + طلب موافقة
            </button>
          )}
          {canCreate && (
            <button onClick={openNew} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition">
              + مهمة
            </button>
          )}
        </div>
      </div>

      {canViewAll && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "الإجمالي", value: summary.total, cls: "" },
            { label: "مفتوحة", value: summary.open, cls: "text-blue-700" },
            { label: "متأخرة", value: summary.overdue, cls: "text-red-600" },
            { label: "منجزة", value: summary.done, cls: "text-green-700" },
          ].map((c) => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted">{c.label}</div>
              <div className={`text-2xl font-bold tabular mt-1 ${c.cls}`}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end justify-between gap-3 border-b border-border flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {([
            ["all", "الكل"],
            ["mine", "مهامي"],
            ["created", "أنشأتها"],
            ["await", "بانتظار موافقتي"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                filter === k ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {label}
              {k === "await" && awaitingCount > 0 && (
                <span className="mr-1.5 text-[11px] bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5 tabular">
                  {awaitingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mb-1 bg-background border border-border rounded-lg p-0.5">
          {([
            ["list", "قائمة"],
            ["board", "لوحة"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`px-3 py-1 text-sm rounded-md transition ${
                view === k ? "bg-primary text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rowError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{rowError}</p>}

      {view === "board" && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {BOARD_COLUMNS.map((col) => {
              const cards = filtered.filter(
                (t) => t.item_type !== "request" && (statusOverrides[t.id] ?? t.status) === col.key,
              );
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    moveTask(id, col.key);
                    setDragId(null);
                  }}
                  className="w-72 shrink-0 bg-background/60 border border-border rounded-xl p-2"
                >
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className={`text-sm font-medium rounded-full px-2.5 py-0.5 ${col.cls}`}>{col.label}</span>
                    <span className="text-xs text-muted tabular">{cards.length}</span>
                  </div>
                  <div className="space-y-2 mt-1 min-h-16">
                    {cards.map((t) => {
                      const pr = PRIORITY[t.priority] ?? PRIORITY.medium;
                      const overdue = t.due_date && t.due_date < today() && col.key !== "done" && col.key !== "rejected";
                      const canEdit = canCreate && (t.created_by === currentUserId || canViewAll);
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragId(t.id);
                          }}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => canEdit && openEdit(t)}
                          className={`bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition ${
                            dragId === t.id ? "opacity-50" : "hover:border-primary"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug">{t.title}</p>
                            <span className={`text-[10px] rounded-full px-1.5 py-0.5 shrink-0 ${pr.cls}`}>{pr.label}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-muted flex-wrap">
                            {t.due_date && (
                              <span className={overdue ? "text-red-600 font-medium" : ""}>⏱ {fmtDate(t.due_date)}</span>
                            )}
                            {t.assignees.length > 0 && <span>👤 {t.assignees.map((a) => a.name).join("، ")}</span>}
                            {t.comments.length > 0 && <span>💬 {t.comments.length}</span>}
                          </div>
                        </div>
                      );
                    })}
                    {cards.length === 0 && (
                      <div className="text-center text-xs text-muted py-4 border border-dashed border-border rounded-lg">
                        اسحب مهمة هنا
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "list" && (
      <div className="space-y-3">
        {filtered.map((t) => {
          const pr = PRIORITY[t.priority] ?? PRIORITY.medium;
          const st = STATUS[t.status] ?? STATUS.new;
          const isRequest = t.item_type === "request";
          const appr = APPROVAL[t.approval_status ?? "pending"] ?? APPROVAL.pending;
          const canDecide =
            isRequest && t.approval_status === "pending" && canApprove && t.approver_id === currentUserId;
          const overdue = t.due_date && t.due_date < today() && t.status !== "done" && t.status !== "rejected";
          const isOpen = expanded === t.id;
          const canEdit = !isRequest && canCreate && (t.created_by === currentUserId || canViewAll);
          const canDeleteRow = isRequest
            ? t.created_by === currentUserId || canViewAll
            : canEdit;
          return (
            <div key={t.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => setExpanded(isOpen ? null : t.id)} className="font-semibold hover:text-primary transition text-right">
                        {t.title}
                      </button>
                      {isRequest && (
                        <span className="text-[11px] rounded-full px-2 py-0.5 bg-primary/10 text-primary">طلب</span>
                      )}
                      <span className={`text-[11px] rounded-full px-2 py-0.5 ${pr.cls}`}>{pr.label}</span>
                      {isRequest ? (
                        <span className={`text-[11px] rounded-full px-2 py-0.5 ${appr.cls}`}>{appr.label}</span>
                      ) : (
                        <span className={`text-[11px] rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted flex-wrap">
                      {t.due_date && (
                        <span className={overdue ? "text-red-600 font-medium" : ""}>
                          الاستحقاق: {fmtDate(t.due_date)}{overdue ? " (متأخرة)" : ""}
                        </span>
                      )}
                      {isRequest && t.approver_name && <span>المسؤول: {t.approver_name}</span>}
                      {!isRequest && t.assignees.length > 0 && (
                        <span>المكلَّفون: {t.assignees.map((a) => a.name).join("، ")}</span>
                      )}
                      {t.related_type && t.related_label && (
                        <span className="bg-background rounded px-2 py-0.5">
                          {REL_LABEL[t.related_type]}: {t.related_label}
                        </span>
                      )}
                      {t.comments.length > 0 && <span>💬 {t.comments.length}</span>}
                    </div>
                  </div>
                  <button onClick={() => setExpanded(isOpen ? null : t.id)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition shrink-0">
                    {isOpen ? "إخفاء" : "تفاصيل"}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-4 bg-background/40">
                  {t.description && <p className="text-sm whitespace-pre-wrap">{t.description}</p>}

                  {isRequest && t.decision_note && (
                    <p className="text-sm bg-background border border-border rounded-lg px-3 py-2">
                      <span className="text-muted">ملاحظة القرار: </span>
                      {t.decision_note}
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {isRequest ? (
                      <>
                        {canDecide && (
                          <>
                            <button disabled={pending} onClick={() => decide(t, true)} className="text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-1.5 transition disabled:opacity-40">موافقة</button>
                            <button disabled={pending} onClick={() => decide(t, false)} className="text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-1.5 transition disabled:opacity-40">رفض</button>
                          </>
                        )}
                        {!canDecide && t.approval_status === "pending" && (
                          <span className="text-sm text-muted">بانتظار قرار {t.approver_name ?? "المسؤول"}.</span>
                        )}
                      </>
                    ) : (
                      <>
                        {t.status !== "in_progress" && t.status !== "done" && (
                          <button disabled={pending} onClick={() => setStatus(t, "in_progress")} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-card transition disabled:opacity-40">بدء التنفيذ</button>
                        )}
                        {t.status !== "done" && (
                          <button disabled={pending} onClick={() => setStatus(t, "done")} className="text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 transition disabled:opacity-40">إنجاز</button>
                        )}
                        {t.status !== "deferred" && t.status !== "done" && (
                          <button disabled={pending} onClick={() => setStatus(t, "deferred")} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-card transition disabled:opacity-40">تأجيل</button>
                        )}
                        {t.status !== "rejected" && t.status !== "done" && (
                          <button disabled={pending} onClick={() => setStatus(t, "rejected")} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-card transition disabled:opacity-40">رفض</button>
                        )}
                        {canEdit && (
                          <button onClick={() => openEdit(t)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-card transition">تعديل</button>
                        )}
                      </>
                    )}
                    {canDeleteRow && (
                      <button disabled={pending} onClick={() => doDelete(t)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-card transition disabled:opacity-40">حذف</button>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">المرفقات</p>
                    <div className="space-y-1.5 mb-2">
                      {t.attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-sm bg-card border border-border rounded-lg px-3 py-2">
                          <button onClick={() => onDownload(a)} className="text-primary hover:underline text-right truncate flex-1">
                            📎 {a.file_name}
                          </button>
                          <span className="text-xs text-muted tabular shrink-0">{fmtSize(a.file_size)}</span>
                          <button onClick={() => onRemoveAttachment(a)} className="text-muted hover:text-red-600 text-lg leading-none shrink-0" aria-label="حذف المرفق">×</button>
                        </div>
                      ))}
                      {t.attachments.length === 0 && <p className="text-sm text-muted">لا مرفقات.</p>}
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-card transition cursor-pointer">
                      {uploadingId === t.id ? "جارٍ الرفع…" : "+ إرفاق ملف"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingId === t.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUpload(t, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">التعليقات</p>
                    <div className="space-y-2 mb-2">
                      {t.comments.map((c) => (
                        <div key={c.id} className="text-sm bg-card border border-border rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{c.author}</span>
                            <span className="text-xs text-muted tabular">{fmtDateTime(c.created_at)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                        </div>
                      ))}
                      {t.comments.length === 0 && <p className="text-sm text-muted">لا تعليقات بعد.</p>}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={commentText[t.id] ?? ""}
                        onChange={(e) => setCommentText((c) => ({ ...c, [t.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitComment(t); } }}
                        placeholder="أضف تعليقاً…"
                        className="flex-1 border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card text-sm"
                      />
                      <button disabled={pending} onClick={() => submitComment(t)} className="text-sm bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg px-4 transition disabled:opacity-40">إرسال</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-card border border-border rounded-xl px-4 py-12 text-center text-muted">لا توجد مهام.</div>
        )}
      </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "request" ? "طلب موافقة جديد" : editingId ? "تعديل مهمة" : "مهمة جديدة"}
        wide
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">العنوان *</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm mb-1">الوصف</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={inputCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">الأولوية</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskInput["priority"] }))} className={inputCls}>
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجلة</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">تاريخ الاستحقاق</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} dir="ltr" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">ربط بـ</label>
              <select
                value={form.related_type}
                onChange={(e) => setForm((f) => ({ ...f, related_type: e.target.value as FormState["related_type"], related_id: "" }))}
                className={inputCls}
              >
                <option value="">— بلا ربط —</option>
                <option value="merchant">تاجر</option>
                <option value="sales_invoice">فاتورة بيع</option>
                <option value="product">منتج</option>
              </select>
            </div>
            {form.related_type && (
              <div>
                <label className="block text-sm mb-1">اختر {REL_LABEL[form.related_type]}</label>
                <select value={form.related_id} onChange={(e) => setForm((f) => ({ ...f, related_id: e.target.value }))} className={inputCls}>
                  <option value="">— اختر —</option>
                  {relatedOptions(form.related_type).map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {mode === "request" ? (
            <div>
              <label className="block text-sm mb-1">المسؤول عن الموافقة *</label>
              <select
                value={form.approver}
                onChange={(e) => setForm((f) => ({ ...f, approver: e.target.value }))}
                className={inputCls}
              >
                <option value="">— اختر الشخص —</option>
                {users
                  .filter((u) => u.id !== currentUserId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
              </select>
              <p className="text-xs text-muted mt-1">
                يصل الطلب لهذا الشخص فقط ليوافق أو يرفض؛ لا يراه باقي الموظفين.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm mb-1">
                المكلَّفون {!canAssign && <span className="text-xs text-muted">(الإسناد لغيرك يتطلب صلاحية)</span>}
              </label>
              <div className="border border-border rounded-lg p-3 max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                {users.map((u) => {
                  const disabled = !canAssign && u.id !== currentUserId;
                  return (
                    <label key={u.id} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}>
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={form.assignees.includes(u.id)}
                        onChange={() => toggleAssignee(u.id)}
                      />
                      {u.label}
                    </label>
                  );
                })}
                {users.length === 0 && <p className="text-sm text-muted">لا يوجد موظفون متاحون.</p>}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button disabled={pending} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60">{pending ? "جارٍ الحفظ…" : "حفظ"}</button>
            <button type="button" onClick={() => setOpen(false)} className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card";
