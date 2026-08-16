"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV } from "@/lib/navigation";

type Props = {
  permissions: string[];
  fullName: string | null;
  roleNameAr: string | null;
  unreadCount?: number;
};

export default function Sidebar({ permissions, fullName, roleNameAr, unreadCount = 0 }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const permSet = new Set(permissions);
  const notifActive = pathname === "/notifications";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 bg-card border-l border-border min-h-screen flex flex-col">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-bold text-primary leading-tight">
          شركة دار الفاتنة
        </h1>
        <p className="text-xs text-muted mt-0.5">إدارة المبيعات والمخزون</p>
      </div>

      <div className="px-3 pt-3">
        <Link
          href="/notifications"
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
            notifActive ? "bg-primary text-white" : "hover:bg-background text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">🔔 الإشعارات</span>
          {unreadCount > 0 && (
            <span className="text-[11px] bg-red-500 text-white rounded-full min-w-[20px] text-center px-1.5 py-0.5 tabular">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {NAV.map((section) => {
          const visible = section.items.filter(
            (i) => i.permission === null || permSet.has(i.permission),
          );
          if (visible.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="px-2 text-xs font-semibold text-muted mb-1.5">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  if (item.soon) {
                    return (
                      <li key={item.href}>
                        <span className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-muted/60 cursor-default">
                          {item.label}
                          <span className="text-[10px] bg-border rounded px-1.5 py-0.5">
                            قريباً
                          </span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block px-3 py-2 rounded-lg text-sm transition ${
                          active
                            ? "bg-primary text-white"
                            : "hover:bg-background text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-sm font-medium truncate">{fullName ?? "مستخدم"}</p>
        <p className="text-xs text-muted mb-3">{roleNameAr ?? "—"}</p>
        <button
          onClick={signOut}
          className="w-full text-sm border border-border rounded-lg py-2 hover:bg-background transition"
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
