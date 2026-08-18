import { redirect } from "next/navigation";

// التسجيل الذاتي مغلق: الحسابات تُنشأ من قبل مدير النظام فقط
// (الموظفون من صفحة «المستخدمون»، والتجار من صفحة «التجار»).
export default function SignupPage() {
  redirect("/login");
}
