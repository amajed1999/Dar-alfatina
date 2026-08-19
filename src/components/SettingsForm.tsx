"use client";

import { useState, useTransition } from "react";
import { updateSettings } from "@/app/(app)/settings/actions";
import type { Json } from "@/lib/database.types";

type SettingsMap = Record<
  string,
  { value: unknown; description: string | null }
>;

// الحقول القابلة للتحرير مع نوعها ومجموعتها
type FieldDef = { key: string; label: string; type: "text" | "number"; group: string; hint?: string };
const FIELDS: FieldDef[] = [
  // عام
  { key: "company_name", label: "اسم الشركة", type: "text", group: "عام" },
  { key: "base_currency", label: "العملة الأساسية", type: "text", group: "عام" },
  { key: "secondary_currency", label: "العملة الثانوية", type: "text", group: "عام" },
  { key: "usd_to_iqd_rate", label: "سعر صرف الدولار (دينار)", type: "number", group: "عام" },
  { key: "tax_rate", label: "نسبة الضريبة %", type: "number", group: "عام" },
  { key: "default_credit_limit", label: "السقف الائتماني الافتراضي", type: "number", group: "عام" },
  // الموافقات والحدود التشغيلية
  { key: "expense_approval_threshold", label: "حدّ اعتماد المصروف (د.ع)", type: "number", group: "الموافقات والحدود", hint: "المصروف بمبلغ أكبر أو يساوي هذا يحتاج اعتماداً. صفر = كل المصاريف تحتاج اعتماداً." },
  { key: "discount_approval_threshold_pct", label: "نسبة الخصم التي تتطلب اعتماداً %", type: "number", group: "الموافقات والحدود", hint: "خصم الفاتورة الذي يتجاوز هذه النسبة يتطلب صلاحية اعتماد الخصومات." },
  { key: "debt_reminder_min_days", label: "أيام التأخّر لتذكير الديون", type: "number", group: "الموافقات والحدود", hint: "الفواتير الأقدم من هذا العدد من الأيام تُعتبر متأخرة في التذكير اليومي." },
  { key: "reorder_cover_days", label: "أيام التغطية لاقتراح إعادة الطلب", type: "number", group: "الموافقات والحدود", hint: "كمية الشراء المقترحة تكفي لتغطية الطلب المتوقّع لهذا العدد من الأيام." },
  // بادئات الترقيم
  { key: "invoice_prefix", label: "بادئة فواتير البيع", type: "text", group: "بادئات الترقيم" },
  { key: "purchase_prefix", label: "بادئة فواتير الشراء", type: "text", group: "بادئات الترقيم" },
  { key: "payment_prefix", label: "بادئة سندات القبض", type: "text", group: "بادئات الترقيم" },
  { key: "quotation_prefix", label: "بادئة عروض الأسعار", type: "text", group: "بادئات الترقيم" },
];
const GROUPS = ["عام", "الموافقات والحدود", "بادئات الترقيم"];

export default function SettingsForm({ settings }: { settings: SettingsMap }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = settings[f.key]?.value;
      init[f.key] = v == null ? "" : String(v);
    }
    return init;
  });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const entries = FIELDS.map((f) => {
      const raw = values[f.key];
      const value: Json =
        f.type === "number" ? Number(raw || 0) : raw;
      return { key: f.key, value };
    });
    startTransition(async () => {
      const res = await updateSettings(entries);
      setMsg(
        res.ok
          ? { ok: true, text: "تم حفظ الإعدادات." }
          : { ok: false, text: res.error ?? "حدث خطأ" },
      );
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-card border border-border rounded-xl p-5 max-w-2xl space-y-4"
    >
      {GROUPS.map((g) => (
        <div key={g} className="space-y-3">
          <h2 className="text-sm font-semibold text-primary border-b border-border pb-1">{g}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key}>
                <label className="block text-sm mb-1">{f.label}</label>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  dir={f.type === "number" ? "ltr" : undefined}
                  className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                />
                {f.hint && <p className="text-xs text-muted mt-1">{f.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {msg && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${
            msg.ok ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button
        disabled={pending}
        className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 font-medium transition disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
      </button>
    </form>
  );
}
