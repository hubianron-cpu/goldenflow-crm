// Synthetic component browser test. HTTP stays on localhost; CRM/Auth/Supabase are not contacted.
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import test from "node:test";
const require = createRequire(import.meta.url);

// Uses an already-installed Playwright runtime supplied by the caller; installs no dependencies.
const playwrightModule = await import(pathToFileURL(require.resolve(process.env.QA_PLAYWRIGHT_PATH || "playwright")).href);
const { chromium } = playwrightModule.default ?? playwrightModule;

function bundleComponent() {
  const modules = [];
  const ids = new Map();
  function add(path) {
    if (ids.has(path)) return ids.get(path);
    const id = modules.length;
    ids.set(path, id); modules.push("");
    let source = readFileSync(path, "utf8");
    if (/\.tsx?$/.test(path)) source = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    source = source.replaceAll("process.env.NODE_ENV", '"production"');
    source = source.replace(/require\(["']([^"']+)["']\)/g, (_match, name) => {
      let target = name.startsWith("@/") ? resolve(name.slice(2)) : name;
      if (name.startsWith(".")) target = resolve(dirname(path), name);
      if (target.startsWith(process.cwd()) && !existsSync(target)) {
        target = [target + ".ts", target + ".tsx", target + ".js"].find(existsSync) || target;
      }
      return `load(${add(require.resolve(target, { paths: [dirname(path)] }))})`;
    });
    modules[id] = `function(module,exports,load){${source}\n}`;
    return id;
  }
  const react = add(require.resolve("react"));
  const client = add(require.resolve("react-dom/client"));
  const component = add(resolve("components/leads/sales-activity-dialog.tsx"));
  return `(function(){const m=[${modules.join(",")}],c={};function load(i){if(c[i])return c[i].exports;const x=c[i]={exports:{}};m[i](x,x.exports,load);return x.exports;}
    const React=load(${react}),{createRoot}=load(${client}),{SalesActivityDialog}=load(${component});
    const root=createRoot(document.getElementById('root')); let generation=0;
    window.openActivity=(closed=false)=>root.render(React.createElement(SalesActivityDialog,{key:++generation,lead:{id:'10000000-0000-4000-8000-000000000010',name:'QA synthetic lead',status:closed?'נסגר בהצלחה':'לידים חדשים',next_action_date:null,next_action_type:null},onClose:()=>root.render(null),onSaved:()=>{window.saved=(window.saved||0)+1;root.render(null)}}));
    window.openActivity();})();`;
}

test("dialog: desktop/mobile, optional summary, schedule, terminal, history and duplicate/retry safety", async () => {
  const bundle = bundleComponent();
  const cssDir = resolve(".next/static/css");
  const css = existsSync(cssDir) ? readdirSync(cssDir).filter((name) => name.endsWith(".css")).map((name) => readFileSync(join(cssDir, name), "utf8")).join("\n") : "";
  assert.ok(css, "Build first so the real application CSS can be inspected");
  const calls = [];
  let failOnce = false;
  const server = createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle); return; }
    if (request.url.includes("/sales-activities")) {
      response.setHeader("Content-Type", "application/json");
      if (request.method === "GET") {
        response.end(JSON.stringify({ activities: [{ id: "qa", occurred_at: "2026-09-01T10:00:00Z", outcome: "לא ענה", summary: "QA history", next_step_mode: "keep" }] })); return;
      }
      let body = "";
      request.on("data", (part) => { body += part; });
      request.on("end", () => {
        calls.push(JSON.parse(body));
        setTimeout(() => {
          response.statusCode = failOnce ? 503 : 200;
          failOnce = false;
          response.end(JSON.stringify(response.statusCode === 200 ? { activity: { id: "qa" } } : { error: "QA retry" }));
        }, 200);
      });
      return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<html lang="he" dir="rtl" class="theme-dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
    const page = await browser.newPage({ timezoneId: "Asia/Jerusalem" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.route("**/*", (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    await page.getByRole("dialog").waitFor();
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: width > 500 ? 900 : 844 });
      for (const theme of ["theme-dark", "theme-light"]) {
        await page.evaluate((value) => { document.documentElement.className = value; }, theme);
        assert.equal(await page.evaluate(() => window.innerWidth), width);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        const box = await page.getByRole("dialog").boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width);
        if (width === 390 || width === 1440) await page.screenshot({ path: `.test-dist/sales-activity-${width}-${theme}.png` });
      }
    }
    await page.getByText("היסטוריית טיפול (עד 50 פעילויות אחרונות)", { exact: true }).click();
    await page.getByText("QA history", { exact: true }).waitFor();
    await page.getByLabel("תוצאת הטיפול").selectOption("no_answer");
    const save = page.getByRole("button", { name: "שמירת סיכום הטיפול", exact: true });
    await save.evaluate((button) => { button.click(); button.click(); });
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].summary, "");
    assert.equal(calls[0].nextStep, "keep");

    await page.evaluate(() => window.openActivity());
    await page.getByLabel("תוצאת הטיפול").selectOption("later");
    await page.getByLabel("הצעד הבא", { exact: true }).selectOption("schedule");
    await page.getByLabel("תאריך ושעה (זמן המכשיר)").fill("2030-01-02T12:30");
    await save.click(); await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(calls[1].nextActionDate, "2030-01-02T10:30:00.000Z");

    await page.evaluate(() => window.openActivity(true));
    assert.equal(await page.getByLabel("הצעד הבא", { exact: true }).count(), 0);
    await page.getByLabel("תוצאת הטיפול").selectOption("irrelevant");
    await save.click(); await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(calls[2].nextStep, "keep");

    await page.evaluate(() => window.openActivity());
    await page.getByLabel("תוצאת הטיפול").selectOption("whatsapp");
    await page.getByLabel("הצעד הבא", { exact: true }).selectOption("none");
    failOnce = true;
    await save.click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByLabel("תוצאת הטיפול").isDisabled(), true);
    await page.getByRole("button", { name: "ניסיון שמירה נוסף", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(calls[3], calls[4]);
    assert.equal(calls[4].nextStep, "none");

    await page.evaluate(() => window.openActivity());
    const beforeCancel = calls.length;
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(calls.length, beforeCancel);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((done) => server.close(done));
  }
});
