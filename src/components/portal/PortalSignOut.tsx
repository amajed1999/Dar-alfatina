"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PortalSignOut() {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="text-sm border border-border rounded-lg py-1.5 px-3 hover:bg-background transition"
    >
      خروج
    </button>
  );
}
