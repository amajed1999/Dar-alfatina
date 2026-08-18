"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { markRead, markAllRead } from "@/app/(app)/notifications/actions";

export type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const ICON: Record<string, string> = {
  task_assigned: "📌",
  task_due: "⏰",
  task_done: "✅",
  task_comment: "💬",
  order_new: "🧾",
  request_new: "📝",
  request_decided: "⚖️",
  expense_decided: "💰",
  info: "🔔",
};

export default function NotificationsClient({ notifications }: { notifications: NotifRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.is_read).length;

  function open(n: NotifRow) {
    startTransition(async () => {
      if (!n.is_read) await markRead(n.id);
      if (n.link) router.push(n.link);
      else router.refresh();
    });
  }
  function allRead() {
    startTransition(async () => {
      await markAllRead();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">الإشعارات</h1>
          <p className="text-muted mt-1 text-sm">
            {unread > 0 ? `لديك ${unread} إشعاراً غير مقروء.` : "لا إشعارات غير مقروءة."}
          </p>
        </div>
        {unread > 0 && (
          <button
            disabled={pending}
            onClick={allRead}
            className="text-sm border border-border rounded-lg py-2 px-4 hover:bg-background transition disabled:opacity-40"
          >
            تعليم الكل كمقروء
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => open(n)}
            className={`w-full text-right flex items-start gap-3 px-4 py-3 hover:bg-background transition ${
              n.is_read ? "" : "bg-primary/5"
            }`}
          >
            <span className="text-lg leading-none mt-0.5">{ICON[n.type] ?? "🔔"}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2">
                <span className={`font-medium ${n.is_read ? "" : "text-primary"}`}>{n.title}</span>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
              </span>
              {n.body && <span className="block text-sm text-muted truncate">{n.body}</span>}
              <span className="block text-xs text-muted mt-0.5 tabular">{fmtDateTime(n.created_at)}</span>
            </span>
          </button>
        ))}
        {notifications.length === 0 && (
          <div className="px-4 py-12 text-center text-muted">لا توجد إشعارات.</div>
        )}
      </div>
    </div>
  );
}
