import * as XLSX from "xlsx";
import {
  type AvailabilityEntry,
  type AvailabilityLevel,
  type Employee,
  type EmployeeRole,
  type GeneratedSchedule,
  type ParsedScheduleInput,
  type ScheduleWarning,
  type ShiftKey,
  type ShiftRequirement,
  AVAILABILITY_LABELS,
  ROLE_LABELS,
  SHIFT_LABELS,
} from "./types";

const SHIFT_TIMES: Record<ShiftKey, { start: string; end: string }> = {
  morning: { start: "06:30", end: "15:00" },
  afternoon: { start: "14:30", end: "23:00" },
  night: { start: "22:30", end: "07:00" },
  mid_1100_2030: { start: "11:00", end: "20:30" },
  day_0800_1600: { start: "08:00", end: "16:00" },
};

const REQUIRED_SHEETS = ["Employees", "Availability", "Shift Requirements"] as const;
const REQUIRED_COLUMNS: Record<(typeof REQUIRED_SHEETS)[number], string[]> = {
  Employees: ["employee_name", "role", "max_shifts_per_week", "active_for_scheduling"],
  Availability: ["employee_name", "day", "shift_name", "availability"],
  "Shift Requirements": ["day", "shift_name", "start_time", "end_time", "required_shift_leaders", "required_guards"],
};

const DEFAULT_REQUIREMENTS: Record<ShiftKey, Pick<ShiftRequirement, "requiredShiftLeaders" | "requiredGuards">> = {
  morning: { requiredShiftLeaders: 1, requiredGuards: 4 },
  afternoon: { requiredShiftLeaders: 1, requiredGuards: 1 },
  night: { requiredShiftLeaders: 1, requiredGuards: 0 },
  mid_1100_2030: { requiredShiftLeaders: 0, requiredGuards: 1 },
  day_0800_1600: { requiredShiftLeaders: 0, requiredGuards: 0 },
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])) as Record<string, unknown>;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(normalizeCell(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isValidNonNegativeNumber(value: unknown) {
  const normalized = normalizeCell(value);
  if (!normalized) {
    return false;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0;
}

function addWarning(warnings: string[], warningDetails: ScheduleWarning[], warning: ScheduleWarning) {
  warnings.push(warning.message);
  warningDetails.push(warning);
}

function toBoolean(value: unknown) {
  const normalized = normalizeCell(value).toLowerCase();
  return ["true", "yes", "1", "active", "כן", "פעיל", "פעילה"].includes(normalized);
}

export function parseRole(value: unknown): EmployeeRole | "" {
  const normalized = normalizeCell(value).toLowerCase();
  if (normalized === "shift_leader" || normalized === 'אחמ"ש' || normalized === "אחמש") {
    return "shift_leader";
  }

  if (normalized === "guard" || normalized === "מאבטח" || normalized === "מאבטחים") {
    return "guard";
  }

  return "";
}

export function parseAvailability(value: unknown): AvailabilityLevel | "" {
  const normalized = normalizeCell(value).toLowerCase();
  if (normalized === "green" || normalized === "ירוק") {
    return "green";
  }

  if (normalized === "yellow" || normalized === "צהוב") {
    return "yellow";
  }

  if (normalized === "red" || normalized === "אדום") {
    return "red";
  }

  return "";
}

export function parseShiftKey(value: unknown): ShiftKey | "" {
  const normalized = normalizeCell(value).toLowerCase();
  const compact = normalized.replace(/\s/g, "");

  if (["morning", "בוקר"].includes(normalized)) {
    return "morning";
  }

  if (["afternoon", "צהריים", "צהרים"].includes(normalized)) {
    return "afternoon";
  }

  if (["night", "לילה"].includes(normalized)) {
    return "night";
  }

  if (["mid_1100_2030", "11:00-20:30", "1100-2030"].includes(compact)) {
    return "mid_1100_2030";
  }

  if (["day_0800_1600", "08:00-16:00", "0800-1600", "8:00-16:00"].includes(compact)) {
    return "day_0800_1600";
  }

  return "";
}

function getSheetName(workbook: XLSX.WorkBook, sheetName: string) {
  return workbook.SheetNames.find((candidate) => candidate.trim().toLowerCase() === sheetName.toLowerCase());
}

function getRows(workbook: XLSX.WorkBook, sheetName: string) {
  const name = getSheetName(workbook, sheetName);
  const sheet = name ? workbook.Sheets[name] : null;
  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false }).map(normalizeRow);
}

function getSheetHeaders(workbook: XLSX.WorkBook, sheetName: string) {
  const name = getSheetName(workbook, sheetName);
  const sheet = name ? workbook.Sheets[name] : null;
  if (!sheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false }) as unknown as unknown[][];
  return (rows[0] ?? []).map((header) => normalizeHeader(normalizeCell(header))).filter(Boolean);
}

export async function parseScheduleWorkbook(file: File): Promise<ParsedScheduleInput> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const warningDetails: ScheduleWarning[] = [];

  for (const sheetName of REQUIRED_SHEETS) {
    if (!getSheetName(workbook, sheetName)) {
      blockingErrors.push(`חסר גיליון חובה: ${sheetName}`);
      continue;
    }

    const headers = getSheetHeaders(workbook, sheetName);
    const missingColumns = REQUIRED_COLUMNS[sheetName].filter((column) => !headers.includes(column));
    if (missingColumns.length > 0) {
      blockingErrors.push(`בגיליון ${sheetName} חסרות עמודות חובה: ${missingColumns.join(", ")}`);
    }
  }

  const employeeRows = blockingErrors.length ? [] : getRows(workbook, "Employees");
  const availabilityRows = blockingErrors.length ? [] : getRows(workbook, "Availability");
  const requirementRows = blockingErrors.length ? [] : getRows(workbook, "Shift Requirements");

  if (!blockingErrors.length && employeeRows.length === 0) {
    blockingErrors.push("גיליון Employees קיים אבל אין בו עובדים.");
  }

  if (!blockingErrors.length && availabilityRows.length === 0) {
    blockingErrors.push("גיליון Availability קיים אבל אין בו רשומות זמינות.");
  }

  if (!blockingErrors.length && requirementRows.length === 0) {
    blockingErrors.push("גיליון Shift Requirements קיים אבל אין בו דרישות משמרת.");
  }

  const seenEmployees = new Set<string>();
  const duplicateEmployees = new Set<string>();
  const employees: Employee[] = employeeRows.flatMap((row, index) => {
    const employeeName = normalizeCell(row.employee_name);
    const role = parseRole(row.role);
    const hasValidMaxShifts = isValidNonNegativeNumber(row.max_shifts_per_week);

    if (!employeeName) {
      addWarning(warnings, warningDetails, {
        type: "invalid_employee_skipped",
        message: `שורה ${index + 2} בגיליון Employees חסרה שם עובד ולכן דולגה.`,
      });
      return [];
    }

    const normalizedName = employeeName.toLowerCase();
    if (seenEmployees.has(normalizedName)) {
      duplicateEmployees.add(employeeName);
      return [];
    }

    seenEmployees.add(normalizedName);

    if (!hasValidMaxShifts) {
      addWarning(warnings, warningDetails, {
        type: "invalid_employee_skipped",
        message: `לעובד ${employeeName} חסרה מגבלת משמרות תקינה ולכן הוא לא ישובץ.`,
      });
    }

    if (!role) {
      addWarning(warnings, warningDetails, {
        type: "invalid_employee_role_skipped",
        message: `לעובד ${employeeName} חסר תפקיד תקין ולכן הוא לא ישובץ.`,
      });
    }

    return [{
      employeeName,
      role,
      maxShiftsPerWeek: hasValidMaxShifts ? toNumber(row.max_shifts_per_week) : 0,
      activeForScheduling: toBoolean(row.active_for_scheduling),
    }];
  });

  if (duplicateEmployees.size > 0) {
    blockingErrors.push(`נמצאו שמות עובדים כפולים: ${Array.from(duplicateEmployees).join(", ")}. יש לתקן כדי למנוע שיבוץ לא בטוח.`);
  }

  if (!blockingErrors.length && employees.filter((employee) => employee.activeForScheduling && employee.role && employee.maxShiftsPerWeek > 0).length === 0) {
    blockingErrors.push("אין עובדים פעילים עם תפקיד תקין ומגבלת משמרות גדולה מ-0.");
  }

  const availability: AvailabilityEntry[] = availabilityRows.flatMap((row, index) => {
    const shiftKey = parseShiftKey(row.shift_name);
    const availabilityValue = parseAvailability(row.availability);
    const employeeName = normalizeCell(row.employee_name);
    const day = normalizeCell(row.day);
    const rawAvailability = normalizeCell(row.availability);

    if (!employeeName || !day || !shiftKey) {
      addWarning(warnings, warningDetails, {
        type: "invalid_availability_skipped",
        day,
        shiftName: shiftKey ? SHIFT_LABELS[shiftKey] : normalizeCell(row.shift_name),
        message: `שורה ${index + 2} בגיליון Availability חסרה עובד, יום או שם משמרת תקין ולכן דולגה.`,
      });
      return [];
    }

    if (!availabilityValue) {
      addWarning(warnings, warningDetails, {
        type: rawAvailability ? "unknown_availability_treated_unavailable" : "missing_availability_treated_unavailable",
        day,
        shiftName: SHIFT_LABELS[shiftKey],
        message: rawAvailability
          ? `ערך זמינות לא מוכר עבור ${employeeName} ביום ${day}, משמרת ${SHIFT_LABELS[shiftKey]}; ההתייחסות היא כאדום.`
          : `חסרה זמינות עבור ${employeeName} ביום ${day}, משמרת ${SHIFT_LABELS[shiftKey]}; ההתייחסות היא כאדום.`,
      });
    }

    return [{
      employeeName,
      day,
      shiftKey,
      shiftName: SHIFT_LABELS[shiftKey],
      availability: availabilityValue || "red",
      rawAvailability,
    }];
  });

  const shiftRequirements: ShiftRequirement[] = requirementRows.flatMap((row, index) => {
    const shiftKey = parseShiftKey(row.shift_name);
    const day = normalizeCell(row.day);

    if (!day || !shiftKey) {
      addWarning(warnings, warningDetails, {
        type: "invalid_shift_requirement_skipped",
        day,
        shiftName: normalizeCell(row.shift_name),
        message: `דרישת משמרת לא תקינה בשורה ${index + 2} בגיליון Shift Requirements ולכן דולגה.`,
      });
      return [];
    }

    const defaultTime = SHIFT_TIMES[shiftKey];
    const defaults = DEFAULT_REQUIREMENTS[shiftKey];
    const hasShiftLeaderValue = isValidNonNegativeNumber(row.required_shift_leaders);
    const hasGuardValue = isValidNonNegativeNumber(row.required_guards);
    let requiredShiftLeaders = hasShiftLeaderValue ? toNumber(row.required_shift_leaders) : defaults.requiredShiftLeaders;
    let requiredGuards = hasGuardValue ? toNumber(row.required_guards) : defaults.requiredGuards;

    if (!hasShiftLeaderValue || !hasGuardValue) {
      addWarning(warnings, warningDetails, {
        type: "shift_requirement_default_used",
        day,
        shiftName: SHIFT_LABELS[shiftKey],
        message: `דרישת משמרת חסרה או לא תקינה ביום ${day}, משמרת ${SHIFT_LABELS[shiftKey]}; נעשה שימוש בברירת מחדל בטוחה איפה שהוגדרה.`,
      });
    }

    if (["morning", "afternoon", "night"].includes(shiftKey) && requiredShiftLeaders !== 1) {
      requiredShiftLeaders = 1;
      addWarning(warnings, warningDetails, {
        type: "shift_leader_requirement_enforced",
        day,
        shiftName: SHIFT_LABELS[shiftKey],
        message: `משמרת ${SHIFT_LABELS[shiftKey]} ביום ${day} חייבת אחמ"ש אחד; הדרישה תוקנה ל-1.`,
      });
    }

    if (shiftKey === "morning" && requiredGuards !== 4) {
      requiredGuards = 4;
      addWarning(warnings, warningDetails, {
        type: "guard_requirement_enforced",
        day,
        shiftName: SHIFT_LABELS[shiftKey],
        message: `משמרת ${SHIFT_LABELS[shiftKey]} ביום ${day} חייבת 4 מאבטחים; הדרישה תוקנה ל-4.`,
      });
    }

    if ((shiftKey === "afternoon" || shiftKey === "mid_1100_2030") && requiredGuards !== 1) {
      requiredGuards = 1;
      addWarning(warnings, warningDetails, {
        type: "guard_requirement_enforced",
        day,
        shiftName: SHIFT_LABELS[shiftKey],
        message: `משמרת ${SHIFT_LABELS[shiftKey]} ביום ${day} חייבת מאבטח אחד; הדרישה תוקנה ל-1.`,
      });
    }

    return [{
      day,
      shiftKey,
      shiftName: SHIFT_LABELS[shiftKey],
      startTime: normalizeCell(row.start_time) || defaultTime.start,
      endTime: normalizeCell(row.end_time) || defaultTime.end,
      requiredShiftLeaders,
      requiredGuards,
    }];
  });

  if (!blockingErrors.length && shiftRequirements.length === 0) {
    blockingErrors.push("אין דרישות משמרת תקינות ליצירת סידור.");
  }

  return {
    employees,
    availability,
    shiftRequirements,
    blockingErrors,
    warnings,
    warningDetails,
  };
}

export function exportScheduleToExcel(schedule: GeneratedSchedule) {
  const scheduleRows = schedule.shifts.map((shift) => ({
    day: shift.requirement.day,
    shift_name: shift.requirement.shiftName,
    shift_time: `${shift.requirement.startTime}-${shift.requirement.endTime}`,
    assigned_shift_leader: shift.assignedShiftLeaders.join(", "),
    assigned_guards: shift.assignedGuards.join(", "),
    missing_shift_leaders: shift.missingShiftLeaders,
    missing_guards: shift.missingGuards,
    shift_warnings: shift.warnings.join(" | "),
  }));

  const summaryRows = schedule.employeeSummaries.map((summary) => ({
    employee_name: summary.employeeName,
    role: summary.role ? ROLE_LABELS[summary.role] : "",
    max_shifts_per_week: summary.maxShiftsPerWeek,
    assigned_shifts_count: summary.assignedShiftsCount,
    night_shifts_count: summary.nightShiftsCount,
    yellow_shifts_used: summary.yellowShiftsUsed,
    warnings: summary.warnings.join(" | "),
  }));

  const warningRows = schedule.warningDetails.length
    ? schedule.warningDetails.map((warning) => ({
        type: warning.type,
        day: warning.day ?? "",
        shift_name: warning.shiftName ?? "",
        message: warning.message,
      }))
    : schedule.warnings.map((warning) => ({ type: "warning", day: "", shift_name: "", message: warning }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scheduleRows), "Weekly Schedule");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Employee Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(warningRows), "Warnings");
  XLSX.writeFile(workbook, "work-schedule-draft.xlsx");
}

export function getAvailabilityLabel(value: AvailabilityLevel | "") {
  return value ? AVAILABILITY_LABELS[value] : "לא תקין";
}
