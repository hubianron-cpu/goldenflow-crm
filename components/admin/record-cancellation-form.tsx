"use client";

import { useState, type FormEvent } from "react";
import { toJerusalemUtcIso } from "@/lib/subscription-cancellation";

export function RecordCancellationForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");

    const form = event.currentTarget;
    const values = new FormData(form);
    const localEnd = String(values.get("accessUntil") || "");
    const accessUntil = toJerusalemUtcIso(localEnd);
    if (!accessUntil) {
      setMessage("יש לבחור מועד סיום תקין וחד־משמעי לפי שעון ישראל");
      setPending(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/subscriptions/record-cancellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: values.get("userId"),
          growDirectDebitId: values.get("growDirectDebitId"),
          accessUntil,
          growCancellationVerified: values.get("growCancellationVerified") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "לא ניתן לשמור");
      setMessage(`תועד. הגישה תסתיים ב־${new Date(result.accessUntil).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`);
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לשמור");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-right" dir="rtl">
      <label className="block text-sm text-zinc-200">מזהה המשתמש ב־CRM
        <input className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 p-3" name="userId" required autoComplete="off" />
      </label>
      <label className="block text-sm text-zinc-200">מזהה הוראת הקבע ב־Grow
        <input className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 p-3" name="growDirectDebitId" required autoComplete="off" />
      </label>
      <label className="block text-sm text-zinc-200">מועד סיום התקופה ששולמה (שעון ישראל)
        <input className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 p-3" name="accessUntil" type="datetime-local" required />
      </label>
      <label className="flex items-start gap-2 text-sm text-zinc-200">
        <input className="mt-1" name="growCancellationVerified" type="checkbox" required />
        ביטול החיוב החוזר הושלם ואומת ידנית ב־Grow, ומועד סיום הגישה נבדק מול התקופה ששולמה.
      </label>
      <button className="button-primary" type="submit" disabled={pending}>{pending ? "שומר..." : "תעד ביטול וחלון גישה"}</button>
      {message && <p role="status" className="text-sm text-zinc-200">{message}</p>}
    </form>
  );
}
