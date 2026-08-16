"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PendingActivation({ email }: { email: string | null }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
        <h1 className="text-xl font-bold text-primary mb-2">
          حسابك بانتظار التفعيل
        </h1>
        <p className="text-muted text-sm leading-relaxed">
          تم إنشاء حسابك ({email}) بنجاح، لكنه يحتاج تفعيلاً وإسناد دور من مدير
          النظام قبل أن تتمكن من استخدام النظام.
        </p>
        <button
          onClick={signOut}
          className="mt-6 text-sm border border-border rounded-lg py-2 px-6 hover:bg-background transition"
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
