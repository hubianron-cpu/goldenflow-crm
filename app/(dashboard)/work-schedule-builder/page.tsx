"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Upload, WandSparkles } from "lucide-react";
import { exportScheduleToExcel, getAvailabilityLabel, parseScheduleWorkbook } from "@/lib/work-schedule/excel";
import { generateWorkSchedule } from "@/lib/work-schedule/scheduler";
import {
  type GeneratedSchedule,
  type ParsedScheduleInput,
  AVAILABILITY_LABELS,
  ROLE_LABELS,
} from "@/lib/work-schedule/types";
import { cn } from "@/lib/utils";

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">{children}</div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{label}</div>;
}

function warningTone(count: number) {
  if (count === 0) {
    return "border-success/20 bg-success/10 text-green-100";
  }

  return "border-danger/20 bg-danger/10 text-red-100";
}

export default function WorkScheduleBuilderPage() {
  const [input, setInput] = useState<ParsedScheduleInput | null>(null);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState("");

  const allWarnings = useMemo(() => {
    return [...(input?.warnings ?? []), ...(schedule?.warnings ?? [])];
  }, [input?.warnings, schedule?.warnings]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsParsing(true);
    setError("");
    setSchedule(null);

    try {
      const parsed = await parseScheduleWorkbook(file);
      setInput(parsed);
    } catch {
      setError("לא הצלחנו לקרוא את קובץ האקסל. ודא שהקובץ תקין וכולל את הגיליונות הנדרשים.");
    } finally {
      setIsParsing(false);
    }
  }

  function handleGenerateSchedule() {
    if (!input) {
      setError("יש להעלות קובץ אקסל לפני יצירת סידור.");
      return;
    }

    setError("");
    setSchedule(generateWorkSchedule(input.employees, input.availability, input.shiftRequirements));
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold-soft">MVP</p>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">בונה סידור עבודה</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              העלה קובץ Excel עם עובדים, זמינות ודרישות משמרת, צור טיוטת סידור שבועית, ובדוק חריגות לפני יצוא.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <label className="button-secondary cursor-pointer gap-2">
              <Upload className="h-4 w-4" />
              העלאת Excel
              <input accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} type="file" />
            </label>
            <button className="button-primary gap-2" disabled={!input || isParsing} onClick={handleGenerateSchedule} type="button">
              <WandSparkles className="h-4 w-4" />
              יצירת סידור
            </button>
            <button className="button-secondary gap-2" disabled={!schedule} onClick={() => schedule && exportScheduleToExcel(schedule)} type="button">
              <Download className="h-4 w-4" />
              יצוא Excel
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
            <p className="text-xs text-zinc-500">עובדים</p>
            <p className="mt-2 text-2xl font-black text-white">{input?.employees.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
            <p className="text-xs text-zinc-500">רשומות זמינות</p>
            <p className="mt-2 text-2xl font-black text-white">{input?.availability.length ?? 0}</p>
          </div>
          <div className={cn("rounded-2xl border p-4", warningTone(allWarnings.length))}>
            <p className="text-xs opacity-80">אזהרות</p>
            <p className="mt-2 text-2xl font-black">{allWarnings.length}</p>
          </div>
        </div>

        {isParsing ? <p className="mt-4 text-sm text-gold-soft">קורא את הקובץ...</p> : null}
        {error ? <p className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-red-100">{error}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-xl font-black text-white">תצוגת עובדים</h2>
          <div className="mt-4">
            {input?.employees.length ? (
              <TableShell>
                <table className="min-w-full text-sm">
                  <thead className="bg-white/[0.04] text-xs text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 text-right">שם</th>
                      <th className="px-4 py-3 text-right">תפקיד</th>
                      <th className="px-4 py-3 text-right">מקסימום</th>
                      <th className="px-4 py-3 text-right">פעיל</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {input.employees.map((employee) => (
                      <tr key={employee.employeeName}>
                        <td className="px-4 py-3 text-white">{employee.employeeName}</td>
                        <td className="px-4 py-3 text-zinc-300">{employee.role ? ROLE_LABELS[employee.role] : "לא תקין"}</td>
                        <td className="px-4 py-3 text-zinc-300">{employee.maxShiftsPerWeek}</td>
                        <td className="px-4 py-3 text-zinc-300">{employee.activeForScheduling ? "כן" : "לא"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <EmptyState label="לא נטענו עובדים." />
            )}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-xl font-black text-white">תצוגת דרישות משמרת</h2>
          <div className="mt-4">
            {input?.shiftRequirements.length ? (
              <TableShell>
                <table className="min-w-full text-sm">
                  <thead className="bg-white/[0.04] text-xs text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 text-right">יום</th>
                      <th className="px-4 py-3 text-right">משמרת</th>
                      <th className="px-4 py-3 text-right">שעות</th>
                      <th className="px-4 py-3 text-right">{ROLE_LABELS.shift_leader}</th>
                      <th className="px-4 py-3 text-right">מאבטחים</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {input.shiftRequirements.map((requirement, index) => (
                      <tr key={`${requirement.day}-${requirement.shiftKey}-${index}`}>
                        <td className="px-4 py-3 text-white">{requirement.day}</td>
                        <td className="px-4 py-3 text-zinc-300">{requirement.shiftName}</td>
                        <td className="px-4 py-3 text-zinc-300">
                          {requirement.startTime}-{requirement.endTime}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{requirement.requiredShiftLeaders}</td>
                        <td className="px-4 py-3 text-zinc-300">{requirement.requiredGuards}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <EmptyState label="לא נטענו דרישות משמרת." />
            )}
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black text-white">תצוגת זמינות</h2>
        <div className="mt-4">
          {input?.availability.length ? (
            <TableShell>
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.04] text-xs text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-right">עובד</th>
                    <th className="px-4 py-3 text-right">יום</th>
                    <th className="px-4 py-3 text-right">משמרת</th>
                    <th className="px-4 py-3 text-right">זמינות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {input.availability.slice(0, 80).map((entry, index) => (
                    <tr key={`${entry.employeeName}-${entry.day}-${entry.shiftKey}-${index}`}>
                      <td className="px-4 py-3 text-white">{entry.employeeName}</td>
                      <td className="px-4 py-3 text-zinc-300">{entry.day}</td>
                      <td className="px-4 py-3 text-zinc-300">{entry.shiftName}</td>
                      <td className="px-4 py-3 text-zinc-300">{getAvailabilityLabel(entry.availability)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : (
            <EmptyState label="לא נטענה זמינות." />
          )}
        </div>
        {(input?.availability.length ?? 0) > 80 ? <p className="mt-3 text-xs text-zinc-500">מוצגות 80 הרשומות הראשונות בלבד.</p> : null}
      </section>

      <section className="panel p-5">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-gold-soft" />
          <h2 className="text-xl font-black text-white">סידור שבועי</h2>
        </div>
        <div className="mt-4">
          {schedule?.shifts.length ? (
            <TableShell>
              <table className="min-w-[980px] text-sm">
                <thead className="bg-white/[0.04] text-xs text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-right">יום</th>
                    <th className="px-4 py-3 text-right">משמרת</th>
                    <th className="px-4 py-3 text-right">שעות</th>
                    <th className="px-4 py-3 text-right">{ROLE_LABELS.shift_leader}</th>
                    <th className="px-4 py-3 text-right">מאבטחים</th>
                    <th className="px-4 py-3 text-right">חוסרים</th>
                    <th className="px-4 py-3 text-right">אזהרות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {schedule.shifts.map((shift, index) => (
                    <tr key={`${shift.requirement.day}-${shift.requirement.shiftKey}-${index}`}>
                      <td className="px-4 py-3 text-white">{shift.requirement.day}</td>
                      <td className="px-4 py-3 text-zinc-300">{shift.requirement.shiftName}</td>
                      <td className="px-4 py-3 text-zinc-300">
                        {shift.requirement.startTime}-{shift.requirement.endTime}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{shift.assignedShiftLeaders.join(", ") || "-"}</td>
                      <td className="px-4 py-3 text-zinc-300">{shift.assignedGuards.join(", ") || "-"}</td>
                      <td className="px-4 py-3 text-zinc-300">
                        {shift.missingShiftLeaders || shift.missingGuards
                          ? `${shift.missingShiftLeaders ? `${shift.missingShiftLeaders} אחמ"ש` : ""} ${
                              shift.missingGuards ? `${shift.missingGuards} מאבטחים` : ""
                            }`
                          : "אין"}
                      </td>
                      <td className="max-w-sm px-4 py-3 text-xs leading-5 text-red-100">{shift.warnings.join(" | ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : (
            <EmptyState label="לא נוצר סידור עדיין." />
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="panel p-5">
          <h2 className="text-xl font-black text-white">סיכום עובדים</h2>
          <div className="mt-4">
            {schedule?.employeeSummaries.length ? (
              <TableShell>
                <table className="min-w-[760px] text-sm">
                  <thead className="bg-white/[0.04] text-xs text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 text-right">שם</th>
                      <th className="px-4 py-3 text-right">תפקיד</th>
                      <th className="px-4 py-3 text-right">מקסימום</th>
                      <th className="px-4 py-3 text-right">שובץ</th>
                      <th className="px-4 py-3 text-right">לילות</th>
                      <th className="px-4 py-3 text-right">צהובים</th>
                      <th className="px-4 py-3 text-right">אזהרות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {schedule.employeeSummaries.map((summary) => (
                      <tr key={summary.employeeName}>
                        <td className="px-4 py-3 text-white">{summary.employeeName}</td>
                        <td className="px-4 py-3 text-zinc-300">{summary.role ? ROLE_LABELS[summary.role] : "לא תקין"}</td>
                        <td className="px-4 py-3 text-zinc-300">{summary.maxShiftsPerWeek}</td>
                        <td className="px-4 py-3 text-zinc-300">{summary.assignedShiftsCount}</td>
                        <td className="px-4 py-3 text-zinc-300">{summary.nightShiftsCount}</td>
                        <td className="px-4 py-3 text-zinc-300">{summary.yellowShiftsUsed}</td>
                        <td className="max-w-xs px-4 py-3 text-xs leading-5 text-red-100">{summary.warnings.join(" | ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <EmptyState label="סיכום עובדים יוצג לאחר יצירת סידור." />
            )}
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-200" />
            <h2 className="text-xl font-black text-white">אזהרות</h2>
          </div>
          <div className="mt-4 space-y-3">
            {allWarnings.length ? (
              allWarnings.map((warning, index) => (
                <div className="rounded-2xl border border-danger/20 bg-danger/10 p-3 text-sm leading-6 text-red-100" key={`${warning}-${index}`}>
                  {warning}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-green-100">
                אין אזהרות כרגע. {AVAILABILITY_LABELS.green} מקבל עדיפות לפני {AVAILABILITY_LABELS.yellow}, ו-{AVAILABILITY_LABELS.red} לא ישובץ.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
