import {
  type AvailabilityEntry,
  type AvailabilityLevel,
  type Employee,
  type EmployeeRole,
  type EmployeeSummary,
  type GeneratedSchedule,
  type ShiftAssignment,
  type ShiftKey,
  type ShiftRequirement,
  ROLE_LABELS,
  SHIFT_LABELS,
} from "./types";

const SHIFT_ORDER: ShiftKey[] = ["morning", "day_0800_1600", "mid_1100_2030", "afternoon", "night"];

type AssignmentState = {
  assignedCount: Map<string, number>;
  assignedByDay: Map<string, Set<string>>;
  nightCount: Map<string, number>;
  yellowCount: Map<string, number>;
  workedNightBeforeDay: Map<string, Set<string>>;
  summaryWarnings: Map<string, Set<string>>;
  globalWarnings: Set<string>;
};

type Candidate = {
  employee: Employee;
  availability: AvailabilityLevel;
};

function keyFor(employeeName: string, day: string, shiftKey: ShiftKey) {
  return `${employeeName.trim()}|${day.trim()}|${shiftKey}`;
}

function getDayIndexes(requirements: ShiftRequirement[]) {
  const days = Array.from(new Set(requirements.map((requirement) => requirement.day)));
  return new Map(days.map((day, index) => [day, index]));
}

function getPreviousDay(day: string, dayIndexes: Map<string, number>) {
  const index = dayIndexes.get(day);
  if (index === undefined || index === 0) {
    return null;
  }

  return Array.from(dayIndexes.entries()).find(([, dayIndex]) => dayIndex === index - 1)?.[0] ?? null;
}

function sortRequirements(requirements: ShiftRequirement[]) {
  const dayIndexes = getDayIndexes(requirements);

  return [...requirements].sort((a, b) => {
    const daySort = (dayIndexes.get(a.day) ?? 0) - (dayIndexes.get(b.day) ?? 0);
    if (daySort !== 0) {
      return daySort;
    }

    return SHIFT_ORDER.indexOf(a.shiftKey) - SHIFT_ORDER.indexOf(b.shiftKey);
  });
}

function hasConflict(employeeName: string, requirement: ShiftRequirement, state: AssignmentState, dayIndexes: Map<string, number>) {
  const assignedToday = state.assignedByDay.get(requirement.day);
  if (assignedToday?.has(employeeName)) {
    return "לא ניתן לשבץ יותר ממשמרת אחת לעובד באותו יום";
  }

  const previousDay = getPreviousDay(requirement.day, dayIndexes);
  const previousNightWorkers = previousDay ? state.workedNightBeforeDay.get(previousDay) : null;

  // Night shifts end the next morning, so these two morning-style shifts are blocked.
  if ((requirement.shiftKey === "morning" || requirement.shiftKey === "day_0800_1600") && previousNightWorkers?.has(employeeName)) {
    return "עובד שעבד לילה לא יכול לעבוד בבוקר או 08:00-16:00 למחרת";
  }

  return null;
}

function buildCandidates(
  employees: Employee[],
  availability: Map<string, AvailabilityEntry>,
  requirement: ShiftRequirement,
  role: EmployeeRole,
  state: AssignmentState,
  dayIndexes: Map<string, number>,
) {
  const candidates: Candidate[] = [];

  for (const employee of employees) {
    if (!employee.activeForScheduling || employee.role !== role) {
      continue;
    }

    const availabilityEntry = availability.get(keyFor(employee.employeeName, requirement.day, requirement.shiftKey));
    if (!availabilityEntry) {
      continue;
    }

    if (availabilityEntry.availability === "red") {
      continue;
    }

    if (!availabilityEntry.availability) {
      state.globalWarnings.add(
        `ערך זמינות לא תקין עבור ${employee.employeeName} ביום ${requirement.day}, משמרת ${requirement.shiftName}`,
      );
      continue;
    }

    const assignedCount = state.assignedCount.get(employee.employeeName) ?? 0;
    if (assignedCount >= employee.maxShiftsPerWeek) {
      const message = `${employee.employeeName} הגיע/ה למקסימום השבועי (${employee.maxShiftsPerWeek})`;
      state.globalWarnings.add(message);
      state.summaryWarnings.get(employee.employeeName)?.add("הגיע/ה למקסימום המשמרות השבועי");
      continue;
    }

    const conflict = hasConflict(employee.employeeName, requirement, state, dayIndexes);
    if (conflict) {
      state.summaryWarnings.get(employee.employeeName)?.add(conflict);
      continue;
    }

    candidates.push({ employee, availability: availabilityEntry.availability });
  }

  return candidates;
}

function sortCandidates(candidates: Candidate[], requirement: ShiftRequirement, state: AssignmentState) {
  return [...candidates].sort((a, b) => {
    const aAssigned = state.assignedCount.get(a.employee.employeeName) ?? 0;
    const bAssigned = state.assignedCount.get(b.employee.employeeName) ?? 0;
    const aLoad = aAssigned / Math.max(1, a.employee.maxShiftsPerWeek);
    const bLoad = bAssigned / Math.max(1, b.employee.maxShiftsPerWeek);

    if (aLoad !== bLoad) {
      return aLoad - bLoad;
    }

    if (aAssigned !== bAssigned) {
      return aAssigned - bAssigned;
    }

    if (requirement.shiftKey === "night") {
      const aNights = state.nightCount.get(a.employee.employeeName) ?? 0;
      const bNights = state.nightCount.get(b.employee.employeeName) ?? 0;
      if (aNights !== bNights) {
        return aNights - bNights;
      }
    }

    return a.employee.employeeName.localeCompare(b.employee.employeeName, "he");
  });
}

function assignEmployee(employeeName: string, requirement: ShiftRequirement, availability: AvailabilityLevel, state: AssignmentState) {
  state.assignedCount.set(employeeName, (state.assignedCount.get(employeeName) ?? 0) + 1);

  const dayAssignments = state.assignedByDay.get(requirement.day) ?? new Set<string>();
  dayAssignments.add(employeeName);
  state.assignedByDay.set(requirement.day, dayAssignments);

  if (requirement.shiftKey === "night") {
    state.nightCount.set(employeeName, (state.nightCount.get(employeeName) ?? 0) + 1);
    const nightWorkers = state.workedNightBeforeDay.get(requirement.day) ?? new Set<string>();
    nightWorkers.add(employeeName);
    state.workedNightBeforeDay.set(requirement.day, nightWorkers);
  }

  if (availability === "yellow") {
    state.yellowCount.set(employeeName, (state.yellowCount.get(employeeName) ?? 0) + 1);
  }
}

function fillSlots({
  assignment,
  availability,
  dayIndexes,
  employees,
  role,
  slots,
  state,
}: {
  assignment: ShiftAssignment;
  availability: Map<string, AvailabilityEntry>;
  dayIndexes: Map<string, number>;
  employees: Employee[];
  role: EmployeeRole;
  slots: number;
  state: AssignmentState;
}) {
  const assigned: string[] = [];

  for (let slot = 0; slot < slots; slot += 1) {
    const candidates = buildCandidates(employees, availability, assignment.requirement, role, state, dayIndexes).filter(
      (candidate) => !assigned.includes(candidate.employee.employeeName),
    );

    const greenCandidates = sortCandidates(
      candidates.filter((candidate) => candidate.availability === "green"),
      assignment.requirement,
      state,
    );
    const yellowCandidates = sortCandidates(
      candidates.filter((candidate) => candidate.availability === "yellow"),
      assignment.requirement,
      state,
    );

    const chosen = greenCandidates[0] ?? yellowCandidates[0];
    if (!chosen) {
      const roleLabel = ROLE_LABELS[role];
      const message = `חסר ${roleLabel} במשמרת ${assignment.requirement.shiftName} ביום ${assignment.requirement.day}. השיבוץ נשאר ריק כדי לא לשבור כלל.`;
      assignment.warnings.push(message);
      state.globalWarnings.add(message);
      continue;
    }

    if (greenCandidates.length === 0 && yellowCandidates.length > 0) {
      const message = `לא היו מספיק עובדים ירוקים עבור ${assignment.requirement.shiftName} ביום ${assignment.requirement.day}; נעשה שימוש בצהוב.`;
      assignment.warnings.push(message);
      state.globalWarnings.add(message);
    }

    assignEmployee(chosen.employee.employeeName, assignment.requirement, chosen.availability, state);
    assigned.push(chosen.employee.employeeName);

    if (chosen.availability === "yellow") {
      const message = `${chosen.employee.employeeName} שובץ/ה על זמינות צהובה ביום ${assignment.requirement.day}, משמרת ${assignment.requirement.shiftName}`;
      assignment.warnings.push(message);
      state.globalWarnings.add(message);
      state.summaryWarnings.get(chosen.employee.employeeName)?.add("שובץ/ה במשמרת צהובה");
    }
  }

  return assigned;
}

export function generateWorkSchedule(
  employees: Employee[],
  availabilityEntries: AvailabilityEntry[],
  shiftRequirements: ShiftRequirement[],
): GeneratedSchedule {
  const warnings = new Set<string>();
  const activeEmployees = employees.filter((employee) => employee.activeForScheduling);
  const validEmployees = activeEmployees.filter((employee) => {
    if (employee.role !== "shift_leader" && employee.role !== "guard") {
      warnings.add(`לעובד ${employee.employeeName} חסר תפקיד תקין`);
      return false;
    }

    if (!Number.isFinite(employee.maxShiftsPerWeek) || employee.maxShiftsPerWeek < 0) {
      warnings.add(`לעובד ${employee.employeeName} יש מגבלת משמרות לא תקינה`);
      return false;
    }

    return true;
  });

  const dayIndexes = getDayIndexes(shiftRequirements);
  const availability = new Map(availabilityEntries.map((entry) => [keyFor(entry.employeeName, entry.day, entry.shiftKey), entry]));
  const state: AssignmentState = {
    assignedCount: new Map(validEmployees.map((employee) => [employee.employeeName, 0])),
    assignedByDay: new Map(),
    nightCount: new Map(validEmployees.map((employee) => [employee.employeeName, 0])),
    yellowCount: new Map(validEmployees.map((employee) => [employee.employeeName, 0])),
    workedNightBeforeDay: new Map(),
    summaryWarnings: new Map(validEmployees.map((employee) => [employee.employeeName, new Set<string>()])),
    globalWarnings: warnings,
  };

  const shifts = sortRequirements(shiftRequirements).map((requirement) => {
    const assignment: ShiftAssignment = {
      requirement,
      assignedShiftLeaders: [],
      assignedGuards: [],
      missingShiftLeaders: 0,
      missingGuards: 0,
      warnings: [],
    };

    if (requirement.requiredShiftLeaders < 0 || requirement.requiredGuards < 0) {
      const message = `דרישת משמרת לא תקינה ביום ${requirement.day}, משמרת ${requirement.shiftName}`;
      assignment.warnings.push(message);
      state.globalWarnings.add(message);
      return assignment;
    }

    // Rule order: fill shift leaders first, then guard slots, without ever crossing roles.
    assignment.assignedShiftLeaders = fillSlots({
      assignment,
      availability,
      dayIndexes,
      employees: validEmployees,
      role: "shift_leader",
      slots: requirement.requiredShiftLeaders,
      state,
    });

    assignment.assignedGuards = fillSlots({
      assignment,
      availability,
      dayIndexes,
      employees: validEmployees,
      role: "guard",
      slots: requirement.requiredGuards,
      state,
    });

    assignment.missingShiftLeaders = Math.max(0, requirement.requiredShiftLeaders - assignment.assignedShiftLeaders.length);
    assignment.missingGuards = Math.max(0, requirement.requiredGuards - assignment.assignedGuards.length);

    if (assignment.missingShiftLeaders > 0) {
      state.globalWarnings.add(`חסר אחמ"ש למשמרת ${SHIFT_LABELS[requirement.shiftKey]} ביום ${requirement.day}`);
    }

    if (assignment.missingGuards > 0) {
      state.globalWarnings.add(`חסר מאבטח למשמרת ${SHIFT_LABELS[requirement.shiftKey]} ביום ${requirement.day}`);
    }

    return assignment;
  });

  const employeeSummaries: EmployeeSummary[] = validEmployees.map((employee) => ({
    employeeName: employee.employeeName,
    role: employee.role,
    maxShiftsPerWeek: employee.maxShiftsPerWeek,
    assignedShiftsCount: state.assignedCount.get(employee.employeeName) ?? 0,
    nightShiftsCount: state.nightCount.get(employee.employeeName) ?? 0,
    yellowShiftsUsed: state.yellowCount.get(employee.employeeName) ?? 0,
    warnings: Array.from(state.summaryWarnings.get(employee.employeeName) ?? []),
  }));

  return {
    shifts,
    employeeSummaries,
    warnings: Array.from(state.globalWarnings),
  };
}
