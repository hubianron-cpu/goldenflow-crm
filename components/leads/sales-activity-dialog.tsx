"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { isFinalLeadStatus, NEXT_ACTION_TYPES, type Lead, getNextActionLabel } from "@/lib/leads";
import { SALES_OUTCOMES, type SalesActivityInput, type SalesActivityHistoryItem } from "@/lib/sales-activity";

export function SalesActivityDialog({ lead, onClose, onSaved }: {
  lead: Pick<Lead, "id" | "name" | "status" | "next_action_date" | "next_action_type">;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState<SalesActivityInput["nextStep"]>("keep");
  const [nextType, setNextType] = useState("follow-up");
  const [nextDate, setNextDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SalesActivityHistoryItem[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [mounted, setMounted] = useState(false);
  const inFlight = useRef(false);
  // Retain the exact request after an uncertain response so a retry cannot create another activity.
  const pendingRequest = useRef<SalesActivityInput | null>(null);
  const [retryOnly, setRetryOnly] = useState(false);
  const terminal = isFinalLeadStatus(lead.status);
  const dialogRef = useDialogAccessibility(mounted, onClose, busy);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leads/${lead.id}/sales-activities`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("history unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) { setHistory(data.activities); setHistoryState("ready"); }
      })
      .catch(() => { if (!controller.signal.aborted) setHistoryState("error"); });
    return () => controller.abort();
  }, [lead.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    if (!pendingRequest.current) {
      if (nextStep === "schedule" && (!nextDate || !Number.isFinite(new Date(nextDate).getTime()) || new Date(nextDate).getTime() <= Date.now())) {
        setError("יש לבחור תאריך ושעה עתידיים."); return;
      }
      pendingRequest.current = {
        requestId: crypto.randomUUID(), outcome: outcome as SalesActivityInput["outcome"], summary,
        nextStep, nextActionType: nextStep === "schedule" ? nextType as SalesActivityInput["nextActionType"] : null,
        nextActionDate: nextStep === "schedule" ? new Date(nextDate).toISOString() : null,
      };
    }
    inFlight.current = true;
    setBusy(true);
    let saved = false;
    try {
      const response = await fetch(`/api/leads/${lead.id}/sales-activities`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingRequest.current),
      });
      const data = await response.json();
      if (!response.ok) {
        // Only definitive rejection permits changing the payload. 5xx/network failures may have committed.
        if (response.status < 500) { pendingRequest.current = null; setRetryOnly(false); }
        else setRetryOnly(true);
        setError(data.error || "לא ניתן לשמור כרגע.");
      } else { saved = true; }
    } catch {
      setRetryOnly(true);
      setError("לא התקבל אישור שמירה. נסה שוב באותה חלונית כדי למנוע כפילות.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    if (saved) onSaved();
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" dir="rtl">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sales-activity-title" tabIndex={-1}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-gold/20 bg-zinc-950 p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="sales-activity-title" className="text-xl font-black text-white">סיכום טיפול והצעד הבא</h2>
            <p className="mt-1 break-words text-sm text-zinc-400">{lead.name}</p></div>
          <button type="button" className="button-secondary" disabled={busy} onClick={onClose}>סגירה</button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-4" aria-busy={busy}>
          <fieldset disabled={busy || retryOnly} className="space-y-4">
            <label className="block text-sm text-zinc-300">תוצאת הטיפול
              <select className="field mt-1" required value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                <option value="" disabled>בחר תוצאה</option>
                {SALES_OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">מה קרה / מה סוכם? (לא חובה)
              <textarea className="field mt-1 min-h-20" maxLength={2000} value={summary} onChange={(event) => setSummary(event.target.value)} />
            </label>
            <p className="text-xs text-zinc-400">התיעוד אינו משנה את סטטוס הליד. WhatsApp מתועד רק אם ההודעה נשלחה בפועל.</p>
            {terminal ? <p className="text-sm text-zinc-400">הליד סגור. נשמר תיעוד בלבד, ללא שינוי סטטוס או פולואפ.</p> : <>
              <label className="block text-sm text-zinc-300">הצעד הבא
                <select aria-label="הצעד הבא" className="field mt-1" value={nextStep} onChange={(event) => setNextStep(event.target.value as SalesActivityInput["nextStep"])}>
                  <option value="keep">השאר את התכנון הקיים</option>
                  <option value="schedule">קבע המשך טיפול</option>
                  <option value="none">ללא פולואפ נוסף</option>
                </select>
              </label>
              {nextStep === "keep" && <p className="text-xs text-zinc-400">{lead.next_action_date ? `${getNextActionLabel(lead.next_action_type)}: ${new Date(lead.next_action_date).toLocaleString("he-IL")}` : "אין פולואפ מתוכנן כרגע."}</p>}
              {nextStep === "none" && <p className="text-xs text-zinc-400">תכנון הפולואפ בליד יוסר. משימות קיימות נשארות ללא שינוי.</p>}
              {nextStep === "schedule" && <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-zinc-300">סוג הפעולה
                  <select className="field mt-1" value={nextType} onChange={(event) => setNextType(event.target.value)}>
                    {NEXT_ACTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block min-w-0 text-sm text-zinc-300">תאריך ושעה (זמן המכשיר)
                  <input type="datetime-local" required className="field mt-1 min-w-0" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
                </label>
              </div>}
            </>}
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={busy} className="button-primary w-full">{busy ? "שומר..." : retryOnly ? "ניסיון שמירה נוסף" : "שמירת סיכום הטיפול"}</button>
        </form>
        <details className="mt-4 border-t border-white/10 pt-3">
          <summary className="cursor-pointer text-sm text-gold-soft">היסטוריית טיפול (עד 50 פעילויות אחרונות)</summary>
          {historyState === "loading" && <p role="status" className="mt-3 text-sm text-zinc-400">טוען היסטוריה...</p>}
          {historyState === "error" && <p role="alert" className="mt-3 text-sm text-zinc-400">לא ניתן לטעון היסטוריה. סגור ופתח שוב כדי לנסות מחדש.</p>}
          {historyState === "ready" && !history.length && <p className="mt-3 text-sm text-zinc-400">עדיין אין פעילויות מתועדות.</p>}
          <ol className="mt-3 space-y-3">{history.map((item) => <li key={item.id} className="rounded-xl border border-white/10 p-3 text-sm">
            <p className="text-white">{item.outcome || "פעילות מתועדת"}</p>
            <time className="text-xs text-zinc-400" dateTime={item.occurred_at}>{new Date(item.occurred_at).toLocaleString("he-IL")}</time>
            {item.summary && <p className="mt-1 whitespace-pre-wrap break-words text-zinc-300">{item.summary}</p>}
            {item.next_action_date && <p className="mt-1 text-zinc-400">{getNextActionLabel(item.next_action_type)}: {new Date(item.next_action_date).toLocaleString("he-IL")}</p>}
            {item.next_step_mode === "none" && <p className="text-zinc-400">ללא פולואפ נוסף</p>}
          </li>)}</ol>
        </details>
      </div>
    </div>, document.body,
  );
}
