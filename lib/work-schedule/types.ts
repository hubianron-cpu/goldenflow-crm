export type EmployeeRole = "shift_leader" | "guard";
export type AvailabilityLevel = "green" | "yellow" | "red";
export type ShiftKey = "morning" | "afternoon" | "night" | "mid_1100_2030" | "day_0800_1600";

export type Employee = {
  employeeName: string;
  role: EmployeeRole | "";
  maxShiftsPerWeek: number;
  activeForScheduling: boolean;
};

export type AvailabilityEntry = {
  employeeName: string;
  day: string;
  shiftKey: ShiftKey;
  shiftName: string;
  availability: AvailabilityLevel | "";
  rawAvailability: string;
};

export type ShiftRequirement = {
  day: string;
  shiftKey: ShiftKey;
  shiftName: string;
  startTime: string;
  endTime: string;
  requiredShiftLeaders: number;
  requiredGuards: number;
};

export type ParsedScheduleInput = {
  employees: Employee[];
  availability: AvailabilityEntry[];
  shiftRequirements: ShiftRequirement[];
  warnings: string[];
};

export type ShiftAssignment = {
  requirement: ShiftRequirement;
  assignedShiftLeaders: string[];
  assignedGuards: string[];
  missingShiftLeaders: number;
  missingGuards: number;
  warnings: string[];
};

export type EmployeeSummary = {
  employeeName: string;
  role: EmployeeRole | "";
  maxShiftsPerWeek: number;
  assignedShiftsCount: number;
  nightShiftsCount: number;
  yellowShiftsUsed: number;
  warnings: string[];
};

export type GeneratedSchedule = {
  shifts: ShiftAssignment[];
  employeeSummaries: EmployeeSummary[];
  warnings: string[];
};

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  shift_leader: 'אחמ"ש',
  guard: "מאבטח",
};

export const SHIFT_LABELS: Record<ShiftKey, string> = {
  morning: "בוקר",
  afternoon: "צהריים",
  night: "לילה",
  mid_1100_2030: "11:00-20:30",
  day_0800_1600: "08:00-16:00",
};

export const AVAILABILITY_LABELS: Record<AvailabilityLevel, string> = {
  green: "ירוק",
  yellow: "צהוב",
  red: "אדום",
};
