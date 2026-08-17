import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

export default async function Home() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.portalMerchantId) redirect("/portal");
  redirect("/dashboard");
}
