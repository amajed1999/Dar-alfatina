"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/Modal";
import { fmtMoney } from "@/lib/format";
import {
  createMerchant,
  updateMerchant,
  setMerchantStatus,
  logVisit,
  linkPortal,
  unlinkPortal,
  type MerchantPayload,
  type VisitInput,
} from "@/app/(app)/merchants/actions";

export type MerchantRow = {
  id: string;
  name: string;
  shop_name: string | null;
  phone: string | null;
  province: string | null;
  address: string | null;
  credit_limit: number;
  price_tier_id: string | null;
  tier_name: string | null;
  assigned_rep: string | null;
  status: "active" | "suspended";
  notes: string | null;
  balance: number;
  has_portal: boolean;
};
type Tier = { id: string; name_ar: string; sort_order: number };
type Rep = { id: string; full_name: string };

type Props = {
  merchants: MerchantRow[];
  tiers: Tier[];
  reps: Rep[];
  canViewAll: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canVisit: boolean;
  canLinkPortal: boolean;
};

type FormState = {
  name: string;
  shop_name: string;
  phone: string;
  province: string;
  address: string;
  credit_limit: string;
  price_tier_id: string;
  assigned_rep: string;
  status: "active" | "suspended";
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  shop_name: "",
  phone: "",
  province: "",
  address: "",
  credit_limit: "0",
  price_tier_id: "",
  assigned_rep: "",
  status: "active",
  notes: "",
});

export default function MerchantsClient({
  merchants,
  tiers,
  reps,
  canViewAll,
  canCreate,
  canEdit,
  canVisit,
  canLinkPortal,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // زيارة
  const [visitFor, setVisitFor] = useState<MerchantRow | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [visitOutcome, setVisitOutcome] = useState<VisitInput["outcome"]>("other");
  const [visitNotes, setVisitNotes] = useState("");
  const [visitErr, setVisitErr] = useState<string | null>(null);

  function openVisit(m: MerchantRow) {
    setVisitFor(m);
    setGps(null);
    setGpsStatus("idle");
    setVisitOutcome("other");
    setVisitNotes("");
    setVisitErr(null);
    captureGps();
  }
  function captureGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy),
        });
        setGpsStatus("ok");
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
  function submitVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!visitFor) return;
    setVisitErr(null);
    const input: VisitInput = {
      merchant_id: visitFor.id,
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      accuracy: gps?.acc ?? null,
      outcome: visitOutcome,
      notes: visitNotes.trim() || null,
    };
    startTransition(async () => {
      const res = await logVisit(input);
      if (!res.ok) {
        setVisitErr(res.error ?? "تعذّر تسجيل الزيارة");
        return;
      }
      setVisitFor(null);
      router.refresh();
    });
  }

  // بوابة التاجر
  const [portalFor, setPortalFor] = useState<MerchantRow | null>(null);
  const [portalEmail, setPortalEmail] = useState("");
  const [portalErr, setPortalErr] = useState<string | null>(null);

  function openPortal(m: MerchantRow) {
    setPortalFor(m);
    setPortalEmail("");
    setPortalErr(null);
  }
  function submitPortalLink(e: React.FormEvent) {
    e.preventDefault();
    if (!portalFor) return;
    setPortalErr(null);
    startTransition(async () => {
      const res = await linkPortal(portalFor.id, portalEmail);
      if (!res.ok) {
        setPortalErr(res.error ?? "تعذّر الربط");
        return;
      }
      setPortalFor(null);
      router.refresh();
    });
  }
  function doUnlinkPortal() {
    if (!portalFor) return;
    setPortalErr(null);
    startTransition(async () => {
      const res = await unlinkPortal(portalFor.id);
      if (!res.ok) {
        setPortalErr(res.error ?? "تعذّر فكّ الربط");
        return;
      }
      setPortalFor(null);
      router.refresh();
    });
  }

  const repName = (id: string | null) =>
    id ? reps.find((r) => r.id === id)?.full_name ?? "—" : "—";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.shop_name ?? "").toLowerCase().includes(q) ||
        (m.phone ?? "").includes(q) ||
        (m.province ?? "").toLowerCase().includes(q),
    );
  }, [merchants, query]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }
  function openEdit(m: MerchantRow) {
    setEditingId(m.id);
    setError(null);
    setForm({
      name: m.name,
      shop_name: m.shop_name ?? "",
      phone: m.phone ?? "",
      province: m.province ?? "",
      address: m.address ?? "",
      credit_limit: String(m.credit_limit),
      price_tier_id: m.price_tier_id ?? "",
      assigned_rep: m.assigned_rep ?? "",
      status: m.status,
      notes: m.notes ?? "",
    });
    setModalOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("اسم التاجر مطلوب.");
      return;
    }
    const payload: MerchantPayload = {
      name: form.name,
      shop_name: form.shop_name.trim() || null,
      phone: form.phone.trim() || null,
      province: form.province.trim() || null,
      address: form.address.trim() || null,
      credit_limit: Number(form.credit_limit) || 0,
      price_tier_id: form.price_tier_id || null,
      assigned_rep: form.assigned_rep || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    startTransition(async () => {
      const res = editingId
        ? await updateMerchant(editingId, payload)
        : await createMerchant(payload);
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function toggleStatus(m: MerchantRow) {
    startTransition(async () => {
      const res = await setMerchantStatus(
        m.id,
        m.status === "active" ? "suspended" : "active",
      );
      if (!res.ok) setError(res.error ?? "حدث خطأ");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">التجار</h1>
          <p className="text-muted mt-1 text-sm">
            {canViewAll ? "كل التجار." : "التجار المسندون إليك."} الرصيد = الذمة الحالية على التاجر.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openNew}
            className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition"
          >
            + تاجر جديد
          </button>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="بحث بالاسم أو المحل أو الهاتف أو المحافظة…"
        className="w-full sm:max-w-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card"
      />

      {error && !modalOpen && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">التاجر</th>
                <th className="px-4 py-3 font-medium">المحافظة</th>
                <th className="px-4 py-3 font-medium">الهاتف</th>
                <th className="px-4 py-3 font-medium">الفئة</th>
                <th className="px-4 py-3 font-medium">السقف</th>
                <th className="px-4 py-3 font-medium">الرصيد</th>
                {canViewAll && <th className="px-4 py-3 font-medium">المندوب</th>}
                <th className="px-4 py-3 font-medium">الحالة</th>
                {(canEdit || canVisit || canLinkPortal) && <th className="px-4 py-3 font-medium">إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const over = m.credit_limit > 0 && m.balance > m.credit_limit;
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={`/merchants/${m.id}/statement`} className="font-medium text-primary hover:underline">
                        {m.name}
                      </Link>
                      {m.shop_name && (
                        <div className="text-xs text-muted">{m.shop_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{m.province ?? "—"}</td>
                    <td className="px-4 py-3 text-muted tabular" dir="ltr">
                      {m.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">{m.tier_name ?? "—"}</td>
                    <td className="px-4 py-3 tabular">{fmtMoney(m.credit_limit)}</td>
                    <td className="px-4 py-3 tabular">
                      <span className={over ? "text-red-600 font-medium" : ""}>
                        {fmtMoney(m.balance)}
                      </span>
                      {over && (
                        <span className="text-[10px] bg-red-50 text-red-700 rounded px-1.5 py-0.5 mr-2">
                          تجاوز السقف
                        </span>
                      )}
                    </td>
                    {canViewAll && (
                      <td className="px-4 py-3 text-muted">{repName(m.assigned_rep)}</td>
                    )}
                    <td className="px-4 py-3">
                      {m.status === "active" ? (
                        <span className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">
                          نشط
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1">
                          موقوف
                        </span>
                      )}
                    </td>
                    {(canEdit || canVisit || canLinkPortal) && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          {canVisit && (
                            <button
                              onClick={() => openVisit(m)}
                              className="text-sm bg-primary/10 text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/20 transition"
                            >
                              📍 زيارة
                            </button>
                          )}
                          {canLinkPortal && (
                            <button
                              onClick={() => openPortal(m)}
                              className={`text-sm border rounded-lg px-3 py-1.5 transition ${
                                m.has_portal
                                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                  : "border-border hover:bg-background"
                              }`}
                            >
                              {m.has_portal ? "🔓 بوابة" : "🔗 بوابة"}
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => openEdit(m)}
                              className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition"
                            >
                              تعديل
                            </button>
                          )}
                          {canEdit && (
                            <button
                              disabled={pending}
                              onClick={() => toggleStatus(m)}
                              className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40"
                            >
                              {m.status === "active" ? "إيقاف" : "تفعيل"}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted">
                    لا يوجد تجار مطابقون.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "تعديل تاجر" : "تاجر جديد"}
        wide
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="اسم التاجر *">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="اسم المحل">
              <input
                value={form.shop_name}
                onChange={(e) => setForm((f) => ({ ...f, shop_name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="الهاتف">
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                dir="ltr"
                className={inputCls}
              />
            </Field>
            <Field label="المحافظة / المنطقة">
              <input
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="العنوان">
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="السقف الائتماني (دينار)">
              <input
                type="number"
                min="0"
                step="any"
                value={form.credit_limit}
                onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
                dir="ltr"
                className={inputCls}
              />
            </Field>
            <Field label="فئة السعر">
              <select
                value={form.price_tier_id}
                onChange={(e) => setForm((f) => ({ ...f, price_tier_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">— بلا فئة —</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_ar}
                  </option>
                ))}
              </select>
            </Field>
            {canViewAll && (
              <Field label="المندوب المسؤول">
                <select
                  value={form.assigned_rep}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_rep: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— غير مسند —</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="الحالة">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as "active" | "suspended" }))
                }
                className={inputCls}
              >
                <option value="active">نشط</option>
                <option value="suspended">موقوف</option>
              </select>
            </Field>
          </div>
          <Field label="ملاحظات">
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={inputCls}
            />
          </Field>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              disabled={pending}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60"
            >
              {pending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!visitFor}
        onClose={() => setVisitFor(null)}
        title={`تسجيل زيارة: ${visitFor?.name ?? ""}`}
      >
        <form onSubmit={submitVisit} className="space-y-4">
          <div className="bg-background rounded-lg px-4 py-3 text-sm">
            {gpsStatus === "loading" && <span className="text-muted">جارٍ تحديد الموقع…</span>}
            {gpsStatus === "ok" && gps && (
              <span className="text-green-700">
                📍 تم تحديد الموقع (دقة ~{gps.acc} م){" "}
                <a
                  href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  عرض على الخريطة
                </a>
              </span>
            )}
            {gpsStatus === "error" && (
              <span className="text-amber-700">
                تعذّر تحديد الموقع (قد يكون مرفوضاً).{" "}
                <button type="button" onClick={captureGps} className="text-primary hover:underline">
                  إعادة المحاولة
                </button>{" "}
                — يمكنك التسجيل بلا موقع.
              </span>
            )}
            {gpsStatus === "idle" && (
              <button type="button" onClick={captureGps} className="text-primary hover:underline">
                تحديد الموقع
              </button>
            )}
          </div>

          <Field label="نتيجة الزيارة">
            <select
              value={visitOutcome}
              onChange={(e) => setVisitOutcome(e.target.value as VisitInput["outcome"])}
              className={inputCls}
            >
              <option value="order">طلبية</option>
              <option value="collection">تحصيل</option>
              <option value="follow_up">متابعة</option>
              <option value="no_order">بلا طلب</option>
              <option value="other">أخرى</option>
            </select>
          </Field>
          <Field label="ملاحظات">
            <input
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              className={inputCls}
            />
          </Field>

          {visitErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{visitErr}</p>}

          <div className="flex gap-3 pt-1">
            <button
              disabled={pending}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60"
            >
              {pending ? "جارٍ التسجيل…" : "تسجيل الزيارة"}
            </button>
            <button
              type="button"
              onClick={() => setVisitFor(null)}
              className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!portalFor}
        onClose={() => setPortalFor(null)}
        title={`بوابة التاجر: ${portalFor?.name ?? ""}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted leading-relaxed">
            تتيح البوابة للتاجر تسجيل الدخول لرؤية رصيده وفواتيره وكشف حسابه (قراءة فقط).
            يجب أن ينشئ التاجر حساباً من صفحة التسجيل أولاً، ثم تربط بريده هنا.
          </p>
          {portalFor?.has_portal ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              ✓ هذا التاجر مرتبط بحساب بوابة حالياً.
            </div>
          ) : (
            <div className="bg-background rounded-lg px-3 py-2 text-sm text-muted">لا حساب بوابة مرتبط بعد.</div>
          )}
          <form onSubmit={submitPortalLink} className="space-y-3">
            <Field label="بريد حساب التاجر">
              <input
                type="email"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                dir="ltr"
                placeholder="merchant@example.com"
                className={inputCls}
              />
            </Field>
            {portalErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{portalErr}</p>}
            <div className="flex gap-3 pt-1 flex-wrap">
              <button
                disabled={pending}
                className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60"
              >
                {pending ? "جارٍ…" : "ربط الحساب"}
              </button>
              {portalFor?.has_portal && (
                <button
                  type="button"
                  onClick={doUnlinkPortal}
                  disabled={pending}
                  className="border border-red-200 text-red-700 rounded-lg py-2.5 px-6 text-sm hover:bg-red-50 transition disabled:opacity-40"
                >
                  فكّ الربط
                </button>
              )}
              <button
                type="button"
                onClick={() => setPortalFor(null)}
                className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition"
              >
                إغلاق
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      {children}
    </div>
  );
}
