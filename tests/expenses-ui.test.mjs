// Render the actual component and built CSS with synthetic localhost-only HTTP fixtures.
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import test from "node:test";
const require = createRequire(import.meta.url);
const imported = await import(pathToFileURL(require.resolve(process.env.QA_PLAYWRIGHT_PATH || "playwright")).href);
const { chromium } = imported.default ?? imported;

function bundle() {
  const modules = [], ids = new Map();
  function add(path) {
    if (ids.has(path)) return ids.get(path);
    const id = modules.length; ids.set(path, id); modules.push("");
    let source = readFileSync(path, "utf8");
    if (/\.tsx?$/.test(path)) source = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    source = source.replaceAll("process.env.NODE_ENV", '"production"');
    source = source.replace(/require\(["']([^"']+)["']\)/g, (_, name) => {
      let target = name.startsWith("@/") ? resolve(name.slice(2)) : name.startsWith(".") ? resolve(dirname(path), name) : name;
      if (target.startsWith(process.cwd()) && !existsSync(target)) target = [target + ".ts", target + ".tsx", target + ".js"].find(existsSync) || target;
      return `load(${add(require.resolve(target, { paths: [dirname(path)] }))})`;
    });
    modules[id] = `function(module,exports,load){${source}\n}`; return id;
  }
  const react = add(require.resolve("react")), client = add(require.resolve("react-dom/client")), component = add(resolve("components/expenses/expense-center.tsx"));
  return `(function(){const m=[${modules.join(",")}],c={};function load(i){if(c[i])return c[i].exports;const x=c[i]={exports:{}};m[i](x,x.exports,load);return x.exports;}load(${client}).createRoot(document.getElementById('root')).render(load(${react}).createElement(load(${component}).ExpenseCenter));})();`;
}
test("expense UI: real component, desktop/mobile/RTL, themes, form and pending state", async () => {
  const script = bundle();
  const cssDir = resolve(".next/static/css");
  const css = readdirSync(cssDir).filter(n => n.endsWith(".css")).map(n => readFileSync(join(cssDir, n), "utf8")).join("\n");
  assert.ok(css.length);
  const initial = { today: "2026-09-20", timeZone: "Asia/Jerusalem", manual: [
    { id: "qa1", title: "Meta Ads", amount_agorot: 150000, due_date: "2026-09-20", status: "planned", category: "", notes: "" },
    { id: "qa2", title: "רואה חשבון", amount_agorot: 50000, due_date: "2026-09-22", status: "planned", category: "", notes: "" },
    { id: "qa3", title: "Vercel", amount_agorot: 7000, due_date: "2026-09-25", status: "planned", category: "", notes: "" },
  ], events: Array.from({ length: 8 }, (_, i) => ({ event_id: `meeting${i}`, title: "פגישה", starts_at: "2026-09-21T07:00:00Z", ends_at: i === 7 ? "2026-09-21T08:15:00Z" : "2026-09-21T07:45:00Z", event_date: "2026-09-21", all_day: false, amount_agorot: null, is_meeting: true, expense_status: "planned" })), connection: { configured: false, connected: true, lastSync: "2026-09-20T10:00:00Z", reconnect: false, stale: false } };
  let fixture = structuredClone(initial), posts = 0;
  const server = createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(script); return; }
    if (req.url === "/api/expenses") {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET") { res.end(JSON.stringify(fixture)); return; }
      let body = ""; req.on("data", chunk => body += chunk); req.on("end", () => {
        const input = JSON.parse(body); posts++;
        if (req.method === "POST") fixture.manual.push({ ...input, amount_agorot: Math.round(Number(input.amount) * 100), status: "planned" });
        setTimeout(() => res.end('{"ok":true}'), 250);
      }); return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="root" style="max-width:1000px;margin:auto;padding:16px"></main><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(error => { server.close(); throw error; });
  const page = await browser.newPage(); const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
  await page.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  mkdirSync(".test-dist/expenses-visual", { recursive: true });
  try {
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.goto(base);
      await page.getByRole("heading", { name: "השבוע שלך", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => innerWidth), width);
      assert.ok(await page.getByText("8 פגישות", { exact: true }).isVisible());
      assert.ok(await page.getByText("6.5 שעות בפגישות", { exact: true }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `.test-dist/expenses-visual/${width}-dark.png`, fullPage: true });
      if (width === 390) {
        for (const theme of ["theme-light", "theme-trainer"]) {
          await page.evaluate(theme => document.documentElement.className = theme, theme);
          await page.screenshot({ path: `.test-dist/expenses-visual/390-${theme}.png`, fullPage: true });
        }
        await page.evaluate(() => document.documentElement.className = "");
      }
      await page.getByRole("button", { name: "30 ימים", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "30 ימים", exact: true }).getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: "הוסף הוצאה", exact: true }).first().click();
      await page.getByRole("dialog").waitFor();
      const box = await page.getByRole("dialog").boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width);
      await page.getByLabel("שם ההוצאה", { exact: true }).fill("QA synthetic expense");
      await page.getByLabel("סכום (₪)", { exact: true }).fill("97");
      const before = posts;
      await page.getByRole("button", { name: "שמירת הוצאה", exact: true }).evaluate(el => { el.click(); el.click(); });
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(posts, before + 1);
      await page.getByText("הנתונים עודכנו", { exact: true }).waitFor();
    }
    fixture = { ...structuredClone(initial), manual: [], events: [], connection: { ...initial.connection, connected: false, lastSync: null } };
    await page.goto(base);
    await page.getByRole("heading", { name: "חבר את יומן Google שלך", exact: true }).waitFor();
    assert.ok(await page.getByText("הרשאת הקריאה מאפשרת גישה לאירועים ביומנים", { exact: false }).isVisible());
    assert.equal(await page.getByRole("link", { name: "למידע על השימוש בנתוני היומן" }).getAttribute("href"), "https://www.goldenflowcrm.com/privacy");
    assert.ok(await page.getByRole("button", { name: "לחץ כאן כדי לחבר את יומן Google שלך", exact: true }).isDisabled());
    assert.ok(await page.getByRole("button", { name: "+ הוסף הוצאה ידנית", exact: true }).isEnabled());
    await page.screenshot({ path: ".test-dist/expenses-visual/360-onboarding.png", fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
