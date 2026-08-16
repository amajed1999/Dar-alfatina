"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      // دخول مباشر (تأكيد البريد معطّل)
      router.push("/dashboard");
      router.refresh();
    } else {
      // تأكيد البريد مفعّل — يلزم فتح رابط التأكيد
      setInfo(
        "تم إنشاء الحساب. تحقّق من بريدك وافتح رابط التأكيد، ثم سجّل الدخول.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">شركة دار الفاتنة</h1>
          <p className="text-muted mt-1 text-sm">إنشاء حساب المدير الأول</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">الاسم الكامل</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-primary"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">كلمة المرور</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-primary"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 font-medium transition disabled:opacity-60"
          >
            {loading ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          لديك حساب؟{" "}
          <Link href="/login" className="text-primary font-medium">
            تسجيل الدخول
          </Link>
        </p>
        <p className="text-center text-xs text-muted mt-3">
          ملاحظة: أول حساب يُنشأ يصبح <b>مدير النظام</b> تلقائياً. الحسابات التالية
          تحتاج تفعيلاً من المدير.
        </p>
      </div>
    </div>
  );
}
