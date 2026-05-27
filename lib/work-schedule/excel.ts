import * as XLSX from "xlsx";
import {
  type AvailabilityEntry,
  type AvailabilityLevel,
  type Employee,
  type EmployeeRole,
  type GeneratedSchedule,
  type ParsedScheduleInput,
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

function getRows(workbook: XLSX.WorkBook, sheetName: string, fallbackIndex: number) {
  const name = workbook.SheetNames.find((candidate) => candidate.trim().toLowerCase() === sheetName.toLowerCase()) ?? workbook.SheetNames[fallbackIndex];
  const sheet = name ? workbook.Sheets[name] : null;
  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false }).map(normalizeRow);
}

export async function parseScheduleWorkbook(file: File): Promise<ParsedScheduleInput> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const warnings: string[] = [];

  const employeeRows = getRows(workbook, "Employees", 0);
  const availabilityRows = getRows(workbook, "Availability", 1);
  const requirementRows = getRows(workbook, "Shift Requirements", 2);

  if (employeeRows.length === 0) {
    warnings.push("לא נמצאו עובדים בגיליון Employees");
  }

  if (availabilityRows.length === 0) {
    warnings.push("לא נמצאה זמינות בגיליון Availability");
  }

  if (requirementRows.length === 0) {
    warnings.push("לא נמצאו דרישות משמרת בגיליון Shift Requirements");
  }

  const employees: Employee[] = employeeRows.map((row, index) => {
    const employeeName = normalizeCell(row.employee_name);
    const role = parseRole(row.role);

    if (!employeeName) {
      warnings.push(`שורה ${index + 2} בגיליון Employees חסרה employee_name`);
    }

    if (!role) {
      warnings.push(`לעובד ${employeeName || `שורה ${index + 2}`} חסר תפקיד תקין`);
    }

    return {
      employeeName,
      role,
      maxShiftsPerWeek: toNumber(row.max_shifts_per_week),
      activeForScheduling: toBoolean(row.active_for_scheduling),
    };
  });

  const availability: AvailabilityEntry[] = availabilityRows.map((row, index) => {
    const shiftKey = parseShiftKey(row.shift_name);
    const availabilityValue = parseAvailability(row.availability);
    const employeeName = normalizeCell(row.employee_name);
    const day = normalizeCell(row.day);

    if (!employeeName || !day || !shiftKey) {
      warnings.push(`שורה ${index + 2} בגיליון Availability חסרה עובד, יום או שם משמרת תקין`);
    }

    if (!availabilityValue) {
      warnings.push(`ערך זמינות לא תקין בשורה ${index + 2} בגיליון Availability`);
    }

    return {
      employeeName,
      day,
      shiftKey: shiftKey || "morning",
      shiftName: shiftKey ? SHIFT_LABELS[shiftKey] : normalizeCell(row.shift_name),
      availability: availabilityValue,
      rawAvailability: normalizeCell(row.availability),
    };
  });

  const shiftRequirements: ShiftRequirement[] = requirementRows.map((row, index) => {
    const shiftKey = parseShiftKey(row.shift_name);
    const day = normalizeCell(row.day);

    if (!day || !shiftKey) {
      warnings.push(`דרישת משמרת לא תקינה בשורה ${index + 2} בגיליון Shift Requirements`);
    }

    const defaultTime = shiftKey ? SHIFT_TIMES[shiftKey] : { start: "", end: "" };

    return {
      day,
      shiftKey: shiftKey || "morning",
      shiftName: shiftKey ? SHIFT_LABELS[shiftKey] : normalizeCell(row.shift_name),
      startTime: normalizeCell(row.start_time) || defaultTime.start,
      endTime: normalizeCell(row.end_time) || defaultTime.end,
      requiredShiftLeaders: toNumber(row.required_shift_leaders),
      requiredGuards: toNumber(row.required_guards),
    };
  });

  return {
    employees: employees.filter((employee) => employee.employeeName),
    availability: availability.filter((entry) => entry.employeeName && entry.day),
    shiftRequirements: shiftRequirements.filter((requirement) => requirement.day),
    warnings,
  };
}

export function exportScheduleToExcel(schedule: GeneratedSchedule) {
  const scheduleRows = schedule.shifts.map((shift) => ({
    Day: shift.requirement.day,
    "Shift name": shift.requirement.shiftName,
    "Shift time": `${shift.requirement.startTime}-${shift.requirement.endTime}`,
    [ROLE_LABELS.shift_leader]: shift.assignedShiftLeaders.join(", "),
    [ROLE_LABELS.guard]: shift.assignedGuards.join(", "),
    "Missing slots": [
      shift.missingShiftLeaders ? `${shift.missingShiftLeaders} ${ROLE_LABELS.shift_leader}` : "",
      shift.missingGuards ? `${shift.missingGuards} ${ROLE_LABELS.guard}` : "",
    ]
      .filter(Boolean)
      .join(", "),
    Warnings: shift.warnings.join(" | "),
  }));

  const summaryRows = schedule.employeeSummaries.map((summary) => ({
    "Employee name": summary.employeeName,
    Role: summary.role ? ROLE_LABELS[summary.role] : "",
    "Max shifts per week": summary.maxShiftsPerWeek,
    "Assigned shifts count": summary.assignedShiftsCount,
    "Night shifts count": summary.nightShiftsCount,
    "Yellow shifts used": summary.yellowShiftsUsed,
    Warnings: summary.warnings.join(" | "),
  }));

  const warningRows = schedule.warnings.map((warning) => ({ Warning: warning }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scheduleRows), "Schedule");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Employee Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(warningRows), "Warnings");
  XLSX.writeFile(workbook, "work-schedule-draft.xlsx");
}

export function getAvailabilityLabel(value: AvailabilityLevel | "") {
  return value ? AVAILABILITY_LABELS[value] : "לא תקין";
}
