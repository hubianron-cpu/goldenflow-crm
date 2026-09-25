import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const types = loadModule("lib/work-schedule/types.ts");
const { generateWorkSchedule } = loadModule("lib/work-schedule/scheduler.ts", { "./types": types });

function loadModule(path, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

function scheduleForGuards(guardCount, requiredGuards) {
  const employees = Array.from({ length: guardCount }, (_, index) => ({
    employeeName: `QA Guard ${index + 1}`,
    role: "guard",
    maxShiftsPerWeek: 2,
    activeForScheduling: true,
  }));
  const availability = employees.map((employee) => ({
    employeeName: employee.employeeName,
    day: "Sunday",
    shiftKey: "morning",
    shiftName: "בוקר",
    availability: "green",
    rawAvailability: "green",
  }));
  const requirements = [{
    day: "Sunday",
    shiftKey: "morning",
    shiftName: "בוקר",
    startTime: "06:30",
    endTime: "15:00",
    requiredShiftLeaders: 0,
    requiredGuards,
  }];
  return generateWorkSchedule(employees, availability, requirements);
}

test("fully staffed shift does not warn that assigned guards were skipped", () => {
  const result = scheduleForGuards(4, 4);
  assert.equal(result.shifts[0].assignedGuards.length, 4);
  assert.equal(result.shifts[0].missingGuards, 0);
  assert.deepEqual(Array.from(result.warnings), []);
  assert.ok(result.employeeSummaries.every((summary) => summary.warnings.length === 0));
});

test("understaffed shift reports shortage but not a conflict for its assigned guard", () => {
  const result = scheduleForGuards(1, 2);
  assert.equal(result.shifts[0].assignedGuards.length, 1);
  assert.equal(result.shifts[0].missingGuards, 1);
  assert.ok(result.warningDetails.some((warning) => warning.type === "missing_guard"));
  assert.ok(result.warningDetails.every((warning) => warning.type !== "same_day_conflict_prevented"));
  assert.deepEqual(Array.from(result.employeeSummaries[0].warnings), []);
});
