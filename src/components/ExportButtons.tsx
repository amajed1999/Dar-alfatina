"use client";

/**
 * أزرار تصدير موحّدة: Excel (CSV بترميز UTF-8 مع BOM ليقرأ العربية) + طباعة/PDF.
 * تُمرَّر لها الرؤوس والصفوف كنصوص جاهزة.
 */
export default function ExportButtons({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  function toCsv() {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
    // BOM لضمان قراءة Excel للعربية
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2 no-print">
      <button
        onClick={toCsv}
        className="text-sm border border-border rounded-lg py-2 px-4 hover:bg-background transition"
      >
        تصدير Excel
      </button>
      <button
        onClick={() => window.print()}
        className="text-sm border border-border rounded-lg py-2 px-4 hover:bg-background transition"
      >
        طباعة / PDF
      </button>
    </div>
  );
}
