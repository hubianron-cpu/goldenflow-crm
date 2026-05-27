import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type RoiToolInsert = Database["public"]["Tables"]["roi_tools"]["Insert"];
type RoiToolUpdate = Database["public"]["Tables"]["roi_tools"]["Update"];
type RoiToolPayload = {
  average_sale_value: number;
  category: string;
  leads_count: number;
  monthly_cost: number;
  name: string;
  notes: string;
  result_type: string;
  sales_count: number;
};
type ValidatedToolPayload =
  | { error: string; tool?: never }
  | {
      error?: never;
      tool: RoiToolPayload;
    };

const roiToolSelect =
  "id, user_id, name, category, monthly_cost, leads_count, sales_count, average_sale_value, result_type, notes, created_at";

function jsonError(message: string, status: number, meta?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...meta }, { status });
}

function getSupabaseErrorMeta(error: {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}) {
  return {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message ?? null,
  };
}

function getRoiToolsErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message?.toLowerCase() ?? "";

  if (error.code === "42P01" || error.code === "PGRST205" || message.includes("roi_tools")) {
    return "טבלת ROI עדיין לא קיימת ב-Supabase. יש להריץ את קובץ ה-SQL של מרכז ROI ואז לרענן את הדף.";
  }

  return error.message || "לא הצלחנו להשלים את הפעולה במרכז ROI.";
}

async function getContext() {
  if (!hasSupabaseEnv()) {
    return { error: jsonError("Supabase is not configured.", 503) };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { error: jsonError(error.message, 401, getSupabaseErrorMeta(error)) };
  }

  if (!user) {
    return { error: jsonError("יש להתחבר כדי לגשת למרכז ROI.", 401) };
  }

  return { supabase, user };
}

function parseSafeNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function parseSafeInteger(value: unknown) {
  const number = parseSafeNumber(value);
  return Number.isFinite(number) ? Math.trunc(number) : Number.NaN;
}

function validateToolPayload(record: Record<string, unknown>): ValidatedToolPayload {
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const category = typeof record.category === "string" ? record.category.trim() : "";
  const notes = typeof record.notes === "string" ? record.notes.trim() : "";
  const resultType = typeof record.result_type === "string" ? record.result_type.trim() : "לידים";
  const monthlyCost = parseSafeNumber(record.monthly_cost);
  const leadsCount = parseSafeInteger(record.leads_count);
  const salesCount = parseSafeInteger(record.sales_count);
  const averageSaleValue = parseSafeNumber(record.average_sale_value);

  if (!name) {
    return { error: "שם ההוצאה / הכלי הוא שדה חובה." };
  }

  if (
    !Number.isFinite(monthlyCost) ||
    !Number.isFinite(leadsCount) ||
    !Number.isFinite(salesCount) ||
    !Number.isFinite(averageSaleValue)
  ) {
    return { error: "יש להזין מספרים תקינים בלבד." };
  }

  if (monthlyCost < 0) {
    return { error: "עלות חודשית לא יכולה להיות שלילית." };
  }

  if (leadsCount < 0) {
    return { error: "כמות תוצאות לא יכולה להיות שלילית." };
  }

  if (salesCount < 0) {
    return { error: "כמות המרות / מכירות לא יכולה להיות שלילית." };
  }

  if (averageSaleValue < 0) {
    return { error: "שווי תוצאה ממוצעת לא יכול להיות שלילי." };
  }

  if (leadsCount > 0 && salesCount > leadsCount) {
    return { error: "כמות המרות / מכירות לא יכולה להיות גבוהה מכמות התוצאות." };
  }

  return {
    tool: {
      average_sale_value: averageSaleValue,
      category,
      leads_count: leadsCount,
      monthly_cost: monthlyCost,
      name,
      notes,
      result_type: resultType || "לידים",
      sales_count: salesCount,
    },
  };
}

export async function GET() {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const { data, error } = await context.supabase
    .from("roi_tools")
    .select(roiToolSelect)
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(getRoiToolsErrorMessage(error), 500, getSupabaseErrorMeta(error));
  }

  return NextResponse.json({ tools: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const parsed = validateToolPayload(body as Record<string, unknown>);

  if (parsed.error) {
    return jsonError(parsed.error, 400);
  }

  const tool = parsed.tool;
  if (!tool) {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const insertPayload: RoiToolInsert = {
    ...tool,
    user_id: context.user.id,
  };

  const { data, error } = await context.supabase
    .from("roi_tools")
    .insert(insertPayload)
    .select(roiToolSelect)
    .single();

  if (error) {
    return jsonError(getRoiToolsErrorMessage(error), 500, getSupabaseErrorMeta(error));
  }

  return NextResponse.json({ tool: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const record = body as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";

  if (!id) {
    return jsonError("מזהה כלי חסר.", 400);
  }

  const parsed = validateToolPayload(record);

  if (parsed.error) {
    return jsonError(parsed.error, 400);
  }

  const tool = parsed.tool;
  if (!tool) {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const updatePayload: RoiToolUpdate = tool;

  const { data, error } = await context.supabase
    .from("roi_tools")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select(roiToolSelect)
    .single();

  if (error) {
    return jsonError(getRoiToolsErrorMessage(error), 500, getSupabaseErrorMeta(error));
  }

  return NextResponse.json({ tool: data }, { status: 200 });
}

export async function DELETE(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const id = typeof (body as Record<string, unknown>).id === "string" ? (body as Record<string, unknown>).id : "";

  if (!id) {
    return jsonError("מזהה כלי חסר.", 400);
  }

  const { data, error } = await context.supabase
    .from("roi_tools")
    .delete()
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("id")
    .single();

  if (error) {
    return jsonError(getRoiToolsErrorMessage(error), 500, getSupabaseErrorMeta(error));
  }

  return NextResponse.json({ deleted: data?.id ?? id }, { status: 200 });
}
