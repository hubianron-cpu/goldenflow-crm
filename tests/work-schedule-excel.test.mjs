import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

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

const types = loadModule("lib/work-schedule/types.ts");
let exportedWorkbook;
let exportedFileName;
const excel = loadModule("lib/work-schedule/excel.ts", {
  xlsx: { ...XLSX, writeFile(workbook, fileName) { exportedWorkbook = workbook; exportedFileName = fileName; } },
  "./types": types,
});

function sampleWorkbook() {
  const workbook = XLSX.utils.book_new();
  const sheets = [
    ["Employees", [["employee_name", "role", "max_shifts_per_week", "active_for_scheduling"], ["QA Guard", "guard", 2, "yes"]]],
    ["Availability", [["employee_name", "day", "shift_name", "availability"], ["QA Guard", "Sunday", "morning", "green"]]],
    ["Shift Requirements", [["day", "shift_name", "start_time", "end_time", "required_shift_leaders", "required_guards"], ["Sunday", "morning", "06:30", "15:00", 1, 4]]],
  ];
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return workbook;
}

for (const bookType of ["xlsx", "biff8"]) {
  test(`parses a real ${bookType} work-schedule workbook`, async () => {
    assert.equal(XLSX.version, "0.20.3");
    const bytes = XLSX.write(sampleWorkbook(), { bookType, type: "buffer" });
    const input = await excel.parseScheduleWorkbook({
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    });
    assert.deepEqual(Array.from(input.blockingErrors), []);
    assert.equal(input.employees.length, 1);
    assert.equal(input.employees[0].employeeName, "QA Guard");
    assert.equal(input.availability[0].availability, "green");
    assert.equal(input.shiftRequirements[0].requiredGuards, 4);
  });
}

test("exports the three expected work-schedule sheets", () => {
  excel.exportScheduleToExcel({
    shifts: [{
      requirement: { day: "Sunday", shiftName: "בוקר", startTime: "06:30", endTime: "15:00" },
      assignedShiftLeaders: ["QA Leader"], assignedGuards: ["QA Guard"],
      missingShiftLeaders: 0, missingGuards: 3, warnings: [],
    }],
    employeeSummaries: [{
      employeeName: "QA Guard", role: "guard", maxShiftsPerWeek: 2,
      assignedShiftsCount: 1, nightShiftsCount: 0, yellowShiftsUsed: 0, warnings: [],
    }],
    warningDetails: [], warnings: [],
  });
  assert.equal(exportedFileName, "work-schedule-draft.xlsx");
  assert.deepEqual(Array.from(exportedWorkbook.SheetNames), ["Weekly Schedule", "Employee Summary", "Warnings"]);
  const rows = XLSX.utils.sheet_to_json(exportedWorkbook.Sheets["Weekly Schedule"]);
  assert.equal(rows[0].assigned_guards, "QA Guard");
});
