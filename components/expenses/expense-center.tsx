"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Check, Clock3, Pencil, Plus, RefreshCw, Wallet, X } from "lucide-react";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { forecast, formatDate, formatMoney, weeklyMeetings, type ExpenseData, type ExpenseItem, type ManualExpense, type Period } from "@/lib/expenses/model";

const periods: { value: Period; label: string; headline: string }[] = [
  { value: "week", label: "השבוע", headline: "צפוי לצאת השבוע" },
  { value: "month", label: "החודש", headline: "צפוי לצאת החודש" },
  { value: "30", label: "30 ימים", headline: "צפוי לצאת ב־30 הימים הקרובים" },
  { value: "90", label: "90 ימים", headline: "צפוי לצאת ב־90 הימים הקרובים" },
];
const surface = "rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)]";
const secondary = "text-[var(--text-secondary)]";
type Draft = { id: string; title: string; amount: string; due_date: string; category: string; notes: string; status: string; editing: boolean };

export function ExpenseCenter() {
  const [data, setData] = useState<ExpenseData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [draft, setDraft] = useState<Draft | null>(null);
  const lock = useRef(false);
  const dialog = useDialogAccessibility(Boolean(draft), () => setDraft(null), busy);

  async function reload(signal?: AbortSignal) {
    const response = await fetch("/api/expenses", { cache: "no-store", signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "לא הצלחנו לטעון את ההוצאות.");
    setData(payload);
  }
  useEffect(() => {
    const controller = new AbortController();
    const outcome = new URLSearchParams(window.location.search).get("calendar");
    if (outcome === "connected") setNotice("יומן Google מחובר ומעודכן");
    if (outcome === "failed") setError("חיבור היומן לא הושלם. אפשר לנסות שוב.");
    if (outcome === "sync_failed") setError("היומן חובר, אך הסנכרון לא הושלם. לחץ על סנכרון היומן.");
    reload(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function action(url: string, method: string, body?: object) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "לא הצלחנו לשמור. נסה שוב.");
      if (url === "/api/expenses") setDraft(null);
      await reload();
      setNotice(url.includes("sync") ? "יומן Google מחובר ומעודכן" : "הנתונים עודכנו");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "הפעולה לא הושלמה.");
      // A rejected Google refresh may have moved the connection to reconnect-required.
      if (url.includes("calendar")) await reload().catch(() => undefined);
      return false;
    } finally { lock.current = false; setBusy(false); }
  }
  function openExpense(expense?: ManualExpense) {
    setError("");
    setDraft(expense ? { ...expense, amount: String(expense.amount_agorot / 100), editing: true } : {
      id: crypto.randomUUID(), title: "", amount: "", due_date: data!.today, category: "", notes: "", status: "planned", editing: false,
    });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (draft) void action("/api/expenses", draft.editing ? "PATCH" : "POST", draft);
  }
  const result = data ? forecast(data, period) : null;
  const meetings = data ? weeklyMeetings(data) : null;
  const connected = data?.connection.connected;
  const calendarReady = Boolean(connected && data?.connection.lastSync && !data.connection.stale);

  function expenseRow(item: ExpenseItem) {
    const manual = item.source === "manual" ? data?.manual.find(e => e.id === item.id) : undefined;
    return <li key={`${item.source}:${item.id}`} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] py-5 last:border-b-0">
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words font-semibold">{item.title}</p>
        <p className={`mt-1 text-xs ${secondary}`}>{formatDate(item.due_date)} · {item.source === "manual" ? "הוצאה ידנית" : "יומן Google"}{item.status !== "planned" ? ` · ${item.status === "paid" ? "שולמה" : "בוטלה"}` : ""}</p>
      </div>
      <bdi className="text-xl font-bold tabular-nums">{formatMoney(item.amount_agorot)}</bdi>
      <details className="basis-full text-sm sm:basis-auto">
        <summary className={`cursor-pointer py-2 ${secondary}`}>פעולות <span className="sr-only">עבור {item.title}</span></summary>
        <div className="flex flex-wrap gap-2 py-2">
          {manual && <button disabled={busy} className="button-secondary gap-2" onClick={() => openExpense(manual)}><Pencil size={14} aria-hidden="true" />עריכה</button>}
          {item.status === "planned" ? <>
            <button disabled={busy} className="button-secondary gap-2" onClick={() => void action("/api/expenses", "PATCH", { id: item.id, source: item.source, status: "paid" })}><Check size={14} aria-hidden="true" />שולמה</button>
            <button disabled={busy} className="button-secondary" onClick={() => void action("/api/expenses", "PATCH", { id: item.id, source: item.source, status: "cancelled" })}>ביטול הוצאה</button>
          </> : <button disabled={busy} className="button-secondary" onClick={() => void action("/api/expenses", "PATCH", { id: item.id, source: item.source, status: "planned" })}>החזרה לתכנון</button>}
          {manual && <button disabled={busy} className="button-danger" onClick={() => { if (window.confirm("למחוק את ההוצאה הידנית?")) void action("/api/expenses", "DELETE", { id: item.id }); }}>מחיקה</button>}
        </div>
      </details>
    </li>;
  }

  return <div dir="rtl" className="space-y-5 text-[var(--text-primary)]">
    <header className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div><p className={`mb-1 text-sm ${secondary}`}>מבט קדימה על העסק שלך</p><h1 className="text-2xl font-bold sm:text-3xl">ניהול הוצאות</h1></div>
      <button className="button-primary gap-2" disabled={!data || busy} onClick={() => openExpense()}><Plus size={18} aria-hidden="true" />הוסף הוצאה</button>
    </header>
    {error && <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm">{error}{!data && <button className="button-secondary mt-3 block" onClick={() => { setLoading(true); reload().then(() => setError("")).catch(e => setError(e.message)).finally(() => setLoading(false)); }}>נסה שוב</button>}</div>}
    {notice && <p role="status" className={`text-sm ${secondary}`}>{notice}</p>}
    {loading && <div role="status" className={`${surface} p-10 text-center ${secondary}`}>טוען את ההוצאות שלך...</div>}
    {data && !connected && <section className={`${surface} p-6 sm:p-8`} aria-labelledby="calendar-onboarding">
      <CalendarDays aria-hidden="true" className="mb-4 h-9 w-9 text-[var(--color-gold)]" />
      <h2 id="calendar-onboarding" className="text-xl font-bold">{data.connection.reconnect ? "חבר מחדש את יומן Google שלך" : "חבר את יומן Google שלך"}</h2>
      <p className={`mt-3 max-w-xl text-sm leading-7 ${secondary}`}>GoldenFlow ישתמש ביומן כדי לזהות הוצאות ולסכם את הפגישות השבועיות שלך.</p>
      <p className="mt-5 font-semibold">יש הוצאה? כתוב את הסכום בשם האירוע.</p>
      <p className={`mt-2 text-sm ${secondary}`}>לדוגמה: רואה חשבון - 500 ₪</p>
      <p className={`mt-2 text-sm leading-6 ${secondary}`}>אם לא כתבת סכום בשם האירוע, GoldenFlow לא יחשיב אותו כהוצאה.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <form action="/api/calendar/connect" method="post"><button disabled={!data.connection.configured || busy} className="button-primary w-full">לחץ כאן כדי לחבר את יומן Google שלך</button></form>
        <button className="button-secondary" disabled={busy} onClick={() => openExpense()}>+ הוסף הוצאה ידנית</button>
      </div>
      {!data.connection.configured && <p className={`mt-3 text-xs leading-6 ${secondary}`}>חיבור היומן עדיין אינו זמין. אפשר להתחיל עם הוצאות ידניות.</p>}
      <p className={`mt-3 text-xs ${secondary}`}>קריאה בלבד מהיומן הראשי. GoldenFlow לא משנה אירועים ביומן שלך.</p>
    </section>}
    {data && result && (connected || data.manual.length > 0) && <>
      <section className={`${surface} overflow-hidden p-5 sm:p-8`} aria-label="תחזית הוצאות">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-[var(--color-bg-soft)] p-1" role="group" aria-label="תקופת תחזית">
          {periods.map(p => <button key={p.value} aria-pressed={period === p.value} onClick={() => setPeriod(p.value)} className={`min-h-11 rounded-xl px-1 text-sm font-semibold transition ${period === p.value ? "bg-[var(--color-gold)] text-black" : secondary}`}>{p.label}</button>)}
        </div>
        <div className="py-9 sm:py-12">
          <p className={`text-sm sm:text-base ${secondary}`}>{periods.find(p => p.value === period)!.headline}</p>
          <p className="mt-3 break-words text-[clamp(2.5rem,8vw,5rem)] font-black leading-tight tracking-tight tabular-nums"><bdi>{formatMoney(result.total)}</bdi></p>
          <p className={`mt-3 text-sm ${secondary}`}>{result.upcoming.length === 1 ? "הוצאה מתוכננת אחת" : `${result.upcoming.length} הוצאות מתוכננות`} · מהיום</p>
          {connected && !calendarReady && <p className="mt-3 text-sm text-[var(--color-gold)]">{data.connection.lastSync ? "נתוני היומן אינם עדכניים. סנכרן לפני הסתמכות על הסכום." : "הסכום כולל כרגע הוצאות ידניות בלבד. יש לסנכרן את היומן."}</p>}
        </div>
        {connected && meetings && <div className="border-t border-[var(--color-border)] pt-5">
          <h2 className="text-sm font-semibold">השבוע שלך</h2>
          {data.connection.lastSync ? <div className={`mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm ${secondary}`}>
            <span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" size={16} />{meetings.weeklyMeetingCount === 1 ? "פגישה אחת" : `${meetings.weeklyMeetingCount} פגישות`}</span>
            <span className="inline-flex items-center gap-2"><Clock3 aria-hidden="true" size={16} />{new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 }).format(meetings.weeklyMeetingMinutes / 60)} שעות בפגישות</span>
          </div> : <p className={`mt-2 text-sm ${secondary}`}>סנכרן את היומן כדי לראות את סיכום הפגישות.</p>}
          {data.connection.lastSync && !meetings.weeklyMeetingCount && <p className={`mt-3 text-xs leading-6 ${secondary}`}>רוצה שפגישה תיספר ב-GoldenFlow? כתוב &quot;פגישה&quot; בשם האירוע ביומן Google. לדוגמה: פגישה עם לקוחה חדשה</p>}
        </div>}
      </section>
      <section className={`${surface} px-5 py-6 sm:px-8`}>
        <h2 className="text-lg font-bold">ההוצאות הקרובות</h2>
        {result.upcoming.length ? <ul>{result.upcoming.map(expenseRow)}</ul> : <div className={`py-7 text-sm leading-7 ${secondary}`}><Wallet className="mb-3 h-6 w-6" aria-hidden="true" /><p>אין הוצאות מתוכננות בתקופה הזו.</p><button className="button-secondary mt-4" disabled={busy} onClick={() => openExpense()}>+ הוסף הוצאה</button></div>}
        {connected && data.connection.lastSync && !data.events.some(e => e.amount_agorot !== null) && <div className={`mt-3 text-sm leading-7 ${secondary}`}><p className="font-semibold">עדיין אין הוצאות מהיומן</p><p>כדי שהוצאה תופיע כאן, כתוב את הסכום בשם האירוע.</p><p>תשלום לספק - 1,200 ₪</p></div>}
      </section>
    </>}
    {data && (data.manual.some(e => e.status !== "planned" || e.due_date < data.today) || data.events.some(e => e.amount_agorot && e.expense_status !== "planned")) && <details className={`${surface} p-5`}>
      <summary className={`cursor-pointer text-sm ${secondary}`}>הוצאות קודמות, ששולמו או בוטלו</summary>
      <ul>{data.manual.filter(e => e.status !== "planned" || e.due_date < data.today).map(e => expenseRow({ ...e, source: "manual" }))}{data.events.filter(e => e.amount_agorot && e.expense_status !== "planned").map(e => expenseRow({ id: e.event_id, title: e.title, amount_agorot: e.amount_agorot!, due_date: e.event_date, source: "google_calendar", status: e.expense_status }))}</ul>
    </details>}
    {data && (connected || data.connection.reconnect) && <footer className={`flex flex-wrap items-center gap-3 text-xs ${secondary}`}>
      {data.connection.lastSync && <span>סנכרון אחרון: {new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: data.timeZone }).format(new Date(data.connection.lastSync))}</span>}
      {connected && <button className="button-secondary gap-2" disabled={busy} onClick={() => void action("/api/calendar/sync", "POST")}><RefreshCw size={14} aria-hidden="true" />{busy ? "מסנכרן / מעדכן..." : "סנכרון היומן"}</button>}
      <button className="button-secondary" disabled={busy} onClick={() => { if (window.confirm("לנתק את היומן ולהסיר את עותק אירועי היומן מ-GoldenFlow? ההוצאות הידניות יישארו.")) void action("/api/calendar/disconnect", "POST"); }}>ניתוק היומן</button>
    </footer>}
    {draft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={e => { if (e.target === e.currentTarget && !busy) setDraft(null); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="expense-form-title" tabIndex={-1} className={`${surface} max-h-[90dvh] w-full max-w-md overflow-y-auto p-5 sm:p-7`}>
        <div className="mb-5 flex items-center justify-between"><h2 id="expense-form-title" className="text-xl font-bold">{draft.editing ? "עריכת הוצאה" : "הוצאה חדשה"}</h2><button className="button-secondary p-2" aria-label="סגירה" disabled={busy} onClick={() => setDraft(null)}><X size={18} /></button></div>
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm">שם ההוצאה<input className="field mt-2" required maxLength={160} value={draft.title} placeholder="למשל: רואה חשבון" onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
            <label className="block min-w-0 text-sm">סכום (₪)<input className="field mt-2" required inputMode="decimal" value={draft.amount} placeholder="500" onChange={e => setDraft({ ...draft, amount: e.target.value })} /></label>
            <label className="block min-w-0 text-sm">תאריך<input className="field mt-2 min-w-0" required type="date" value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })} /></label>
          </div>
          <details><summary className={`cursor-pointer text-sm ${secondary}`}>קטגוריה והערה (לא חובה)</summary><div className="mt-3 space-y-3">
            <label className="block text-sm">קטגוריה<input className="field mt-2" maxLength={80} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></label>
            <label className="block text-sm">הערה<textarea className="field mt-2" maxLength={1000} rows={2} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
          </div></details>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="button-primary w-full">{busy ? "שומר..." : "שמירת הוצאה"}</button>
        </form>
      </div>
    </div>}
  </div>;
}
