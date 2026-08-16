"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtNum, fmtMoney } from "@/lib/format";
import {
  createProduct,
  updateProduct,
  createCategory,
  setProductActive,
  type ProductPayload,
} from "@/app/(app)/products/actions";

export type ProductRow = {
  id: string;
  sku: string | null;
  name: string | null;
  barcode: string | null;
  category_id: string | null;
  category_name: string | null;
  base_unit_id: string | null;
  base_unit_name: string | null;
  pack_unit_id: string | null;
  pack_unit_name: string | null;
  units_per_pack: number | null;
  reorder_level: number | null;
  has_expiry: boolean | null;
  is_active: boolean | null;
  current_cost: number | null;
  stock_qty: number | null;
  below_reorder: boolean | null;
};

type Category = { id: string; name: string };
type Unit = { id: string; name: string };
type Tier = { id: string; key: string; name_ar: string; sort_order: number };

type Props = {
  products: ProductRow[];
  categories: Category[];
  units: Unit[];
  tiers: Tier[];
  pricesByProduct: Record<string, Record<string, number>>;
  canViewPrices: boolean;
  canCreate: boolean;
  canEdit: boolean;
};

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  category_id: string;
  base_unit_id: string;
  pack_unit_id: string;
  units_per_pack: string;
  reorder_level: string;
  has_expiry: boolean;
  is_active: boolean;
  prices: Record<string, string>; // tierId -> price string
};

function emptyForm(tiers: Tier[]): FormState {
  return {
    name: "",
    sku: "",
    barcode: "",
    category_id: "",
    base_unit_id: "",
    pack_unit_id: "",
    units_per_pack: "",
    reorder_level: "0",
    has_expiry: false,
    is_active: true,
    prices: Object.fromEntries(tiers.map((t) => [t.id, ""])),
  };
}

export default function ProductsClient({
  products,
  categories,
  units,
  tiers,
  pricesByProduct,
  canViewPrices,
  canCreate,
  canEdit,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(tiers));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>(categories);
  const [newCat, setNewCat] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm(tiers));
    setError(null);
    setModalOpen(true);
  }

  function openEdit(p: ProductRow) {
    setEditingId(p.id);
    setError(null);
    const priceMap = pricesByProduct[p.id] ?? {};
    setForm({
      name: p.name ?? "",
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      category_id: p.category_id ?? "",
      base_unit_id: p.base_unit_id ?? "",
      pack_unit_id: p.pack_unit_id ?? "",
      units_per_pack: p.units_per_pack != null ? String(p.units_per_pack) : "",
      reorder_level: p.reorder_level != null ? String(p.reorder_level) : "0",
      has_expiry: !!p.has_expiry,
      is_active: p.is_active ?? true,
      prices: Object.fromEntries(
        tiers.map((t) => [t.id, priceMap[t.id] != null ? String(priceMap[t.id]) : ""]),
      ),
    });
    setModalOpen(true);
  }

  function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const res = await createCategory(name);
      if (!res.ok || !res.id) {
        setError(res.error ?? "تعذّر إنشاء التصنيف");
        return;
      }
      setCats((c) => [...c, { id: res.id!, name }]);
      setForm((f) => ({ ...f, category_id: res.id! }));
      setNewCat("");
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.sku.trim()) {
      setError("الاسم والرمز (SKU) مطلوبان.");
      return;
    }
    const payload: ProductPayload = {
      name: form.name,
      sku: form.sku,
      barcode: form.barcode.trim() || null,
      category_id: form.category_id || null,
      base_unit_id: form.base_unit_id || null,
      pack_unit_id: form.pack_unit_id || null,
      units_per_pack: form.pack_unit_id
        ? Number(form.units_per_pack) || null
        : null,
      reorder_level: Number(form.reorder_level) || 0,
      has_expiry: form.has_expiry,
      is_active: form.is_active,
      prices: tiers
        .map((t) => ({
          price_tier_id: t.id,
          price: Number(form.prices[t.id]) || 0,
        }))
        .filter((p) => p.price > 0),
    };
    startTransition(async () => {
      const res = editingId
        ? await updateProduct(editingId, payload)
        : await createProduct(payload);
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function toggleActive(p: ProductRow) {
    startTransition(async () => {
      const res = await setProductActive(p.id, !p.is_active);
      if (!res.ok) setError(res.error ?? "حدث خطأ");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-muted mt-1 text-sm">
            كتالوج المنتجات وأسعار البيع حسب الفئة. الكمية المعروضة مشتقّة من حركات المخزون.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openNew}
            className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition"
          >
            + منتج جديد
          </button>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="بحث بالاسم أو الرمز أو الباركود…"
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
                <th className="px-4 py-3 font-medium">الرمز</th>
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">التصنيف</th>
                <th className="px-4 py-3 font-medium">الوحدة</th>
                <th className="px-4 py-3 font-medium">المتوفّر</th>
                {canViewPrices && <th className="px-4 py-3 font-medium">التكلفة</th>}
                <th className="px-4 py-3 font-medium">الحالة</th>
                {canEdit && <th className="px-4 py-3 font-medium">إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 tabular text-muted" dir="ltr">
                    {p.sku}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {p.below_reorder && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 rounded px-1.5 py-0.5 mr-2">
                        تحت الحد
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.category_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {p.base_unit_name ?? "—"}
                    {p.pack_unit_name && p.units_per_pack
                      ? ` (${p.pack_unit_name}=${fmtNum(p.units_per_pack)})`
                      : ""}
                  </td>
                  <td className="px-4 py-3 tabular">
                    {fmtNum(p.stock_qty ?? 0)}
                  </td>
                  {canViewPrices && (
                    <td className="px-4 py-3 tabular">
                      {p.current_cost != null ? fmtMoney(p.current_cost) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {p.is_active ? (
                      <span className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">
                        نشط
                      </span>
                    ) : (
                      <span className="text-xs bg-border text-muted rounded-full px-2.5 py-1">
                        موقوف
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition"
                        >
                          تعديل
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => toggleActive(p)}
                          className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40"
                        >
                          {p.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={canViewPrices ? (canEdit ? 8 : 7) : canEdit ? 7 : 6}
                    className="px-4 py-10 text-center text-muted"
                  >
                    لا توجد منتجات مطابقة.
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
        title={editingId ? "تعديل منتج" : "منتج جديد"}
        wide
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="اسم المنتج *">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="الرمز (SKU) *">
              <input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                dir="ltr"
                className={inputCls}
              />
            </Field>
            <Field label="الباركود">
              <input
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                dir="ltr"
                className={inputCls}
              />
            </Field>
            <Field label="التصنيف">
              <div className="flex gap-2">
                <select
                  value={form.category_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category_id: e.target.value }))
                  }
                  className={inputCls}
                >
                  <option value="">— بلا تصنيف —</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="تصنيف جديد"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={addCategory}
                  disabled={pending || !newCat.trim()}
                  className="shrink-0 text-sm border border-border rounded-lg px-3 hover:bg-background transition disabled:opacity-40"
                >
                  إضافة
                </button>
              </div>
            </Field>
            <Field label="الوحدة الأساسية">
              <select
                value={form.base_unit_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, base_unit_id: e.target.value }))
                }
                className={inputCls}
              >
                <option value="">— اختر —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="وحدة التعبئة (كارتون…)">
              <select
                value={form.pack_unit_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pack_unit_id: e.target.value }))
                }
                className={inputCls}
              >
                <option value="">— لا يوجد —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            {form.pack_unit_id && (
              <Field label="عدد الوحدات في التعبئة">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={form.units_per_pack}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, units_per_pack: e.target.value }))
                  }
                  dir="ltr"
                  className={inputCls}
                />
              </Field>
            )}
            <Field label="حد إعادة الطلب">
              <input
                type="number"
                min="0"
                step="any"
                value={form.reorder_level}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reorder_level: e.target.value }))
                }
                dir="ltr"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.has_expiry}
                onChange={(e) =>
                  setForm((f) => ({ ...f, has_expiry: e.target.checked }))
                }
              />
              له تاريخ صلاحية
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
              />
              نشط
            </label>
          </div>

          {canViewPrices && tiers.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">أسعار البيع حسب الفئة</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {tiers.map((t) => (
                  <Field key={t.id} label={t.name_ar}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.prices[t.id] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          prices: { ...f.prices, [t.id]: e.target.value },
                        }))
                      }
                      dir="ltr"
                      className={inputCls}
                    />
                  </Field>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
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
    </div>
  );
}

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      {children}
    </div>
  );
}
