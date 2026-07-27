"use client";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";

export default function BusinessInsightsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="panel p-6 text-center sm:p-8" dir="rtl">
      <h1 className="text-2xl font-black text-white">
        לא הצלחנו לטעון את הסיכומים והמגמות
      </h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
        אפשר לנסות שוב. מרכז העסק והנתונים הקיימים לא השתנו.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <button
          className="button-primary gap-2"
          onClick={reset}
          type="button"
        >
          <RefreshCcw className="h-4 w-4" />
          ניסיון חוזר
        </button>
        <Link className="button-secondary" href="/business-center">
          חזרה למרכז העסק
        </Link>
      </div>
    </section>
  );
}
