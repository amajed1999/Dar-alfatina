"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/lib/format";
import { setTarget } from "@/app/(app)/targets/actions";

export type TargetRow = {
  rep_id: string;
  rep_name: string;
  target_amount: number;
  achieved: number;
  pct: number | null;
  invoices_count: number;
};

function pctColor(pct: number | null): string {
  if (pct == null) return "bg-border";
  if (pct >= 100) return "bg-green-600";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export default function TargetsClient({
  rows,
  month,
  canManage,
}: {
  rows: TargetRow[];
  month: string; // YYYY-MM
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  function changeMonth(ym: string) {
    router.push(`/targets?month=${ym}`);
  }

  function save(row: TargetRow) {
    const raw = drafts[row.rep_id];
    const amount = Number(raw);
    if (raw === undefined || Number.isNaN(amount) || amount < 0) {
      setError("أدخل مبلغاً صحيحاً.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setTarget(row.rep_id, `${month}-01`, amount);
      if (!res.ok) {
        setError(res.error ?? "تعذّر الحفظ");
        return;
      }
      setSavedId(row.rep_id);
      setDrafts((d) => {
        const n = { ...d };
        delete n[row.rep_id];
        return n;
      });
      router.refresh();
      setTimeout(() => setSavedId(null), 1500);
    });
  }

  const totals = rows.reduce(
    (s, r) => ({ target: s.target + r.target_amount, achieved: s.achieved + r.achieved }),
    { target: 0, achieved: 0 },
  );
  const totalPct = totals.target > 0 ? Math.round((totals.achieved / totals.target) * 1000) / 10 : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">أهداف المندوبين</h1>
          <p className="text-muted mt-1 text-sm">
            الهدف الشهري لكل مندوب مقابل المبيعات المحقّقة ونسبة الإنجاز.
          </p>
        </div>
        <label className="text-sm">
          <span className="text-muted ml-2">الشهر</span>
          <input
            type="month"
            value={month}
            onChange={(e) => changeMonth(e.target.value)}
            dir="ltr"
            className="border border-border rounded-lg px-3 py-2 bg-card outline-none focus:border-primary"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted">إجمالي الأهداف</div>
          <div className="text-xl font-bold tabular mt-1">{fmtMoney(totals.target)} د.ع</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted">إجمالي المحقّق</div>
          <div className="text-xl font-bold tabular mt-1">{fmtMoney(totals.achieved)} د.ع</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted">نسبة الإنجاز الكلية</div>
          <div className="text-xl font-bold tabular mt-1">{totalPct == null ? "—" : `${totalPct}%`}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">المندوب</th>
                <th className="px-4 py-3 font-medium">الهدف</th>
                <th className="px-4 py-3 font-medium">المحقّق</th>
                <th className="px-4 py-3 font-medium">الفواتير</th>
                <th className="px-4 py-3 font-medium w-56">نسبة الإنجاز</th>
                {canManage && <th className="px-4 py-3 font-medium">إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const draft = drafts[r.rep_id];
                const dirty = draft !== undefined && Number(draft) !== r.target_amount;
                return (
                  <tr key={r.rep_id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{r.rep_name}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          dir="ltr"
                          value={draft ?? String(r.target_amount)}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.rep_id]: e.target.value }))}
                          className="w-32 border border-border rounded-lg px-2 py-1.5 bg-card outline-none focus:border-primary tabular"
                        />
                      ) : (
                        <span className="tabular">{fmtMoney(r.target_amount)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular">{fmtMoney(r.achieved)}</td>
                    <td className="px-4 py-3 tabular text-muted">{r.invoices_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pctColor(r.pct)}`}
                            style={{ width: `${Math.min(r.pct ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className="tabular text-xs w-12 text-left">
                          {r.pct == null ? "—" : `${r.pct}%`}
                        </span>
                      </div>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <button
                          disabled={pending || !dirty}
                          onClick={() => save(r)}
                          className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40"
                        >
                          {savedId === r.rep_id ? "✓ حُفظ" : "حفظ"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-4 py-10 text-center text-muted">
                    لا يوجد مندوبون لعرضهم.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted">
        «المحقّق» = مجموع فواتير البيع المعتمدة المنسوبة للمندوب خلال الشهر المحدّد.
      </p>
    </div>
  );
}
