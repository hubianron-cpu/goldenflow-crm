import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSubscriptionAccess } from "@/lib/subscription-guard";
import { ACTIVITY_UUID, parseSalesActivity } from "@/lib/sales-activity";

type Context = { params: Promise<{ leadId: string }> };
const historySelect = "id,occurred_at,activity_type,outcome,summary,next_step_mode,next_action_type,next_action_date";
const failure = (error: string, status: number) => NextResponse.json({ error }, { status });

async function authorize(context: Context) {
  const { leadId } = await context.params;
  if (!ACTIVITY_UUID.test(leadId)) return { response: failure("ליד לא נמצא.", 404) };
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: failure("נדרשת התחברות.", 401) };
  const access = await requireSubscriptionAccess(user.id);
  if (!access.ok) return { response: failure(access.error, access.status) };
  const lead = await supabase.from("leads").select("id").eq("id", leadId).eq("user_id", user.id).maybeSingle();
  if (lead.error) return { response: failure("לא ניתן לטעון את הליד כרגע.", 503) };
  if (!lead.data) return { response: failure("ליד לא נמצא.", 404) };
  return { supabase, user, leadId };
}

export async function GET(_request: Request, context: Context) {
  try {
    const auth = await authorize(context);
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("lead_sales_activities")
      .select(historySelect).eq("lead_id", auth.leadId).eq("user_id", auth.user.id)
      .order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(50);
    if (error) {
      console.error("SALES_ACTIVITY_READ_FAILED", { code: error.code });
      return failure("לא ניתן לטעון את היסטוריית הטיפול כרגע.", 503);
    }
    return NextResponse.json({ activities: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure("לא ניתן לטעון את היסטוריית הטיפול כרגע.", 503);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return failure("אין הרשאה לבקשה זו.", 403);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failure("נדרשת בקשת JSON.", 415);
    const auth = await authorize(context);
    if (auth.response) return auth.response;
    const input = parseSalesActivity(await request.json().catch(() => null));
    if (!input) return failure("יש לבדוק את תוצאת הטיפול ואת פרטי הצעד הבא.", 400);
    const { data, error } = await auth.supabase.rpc("record_lead_sales_activity", {
      p_request_id: input.requestId,
      p_lead_id: auth.leadId,
      p_outcome: input.outcome,
      p_summary: input.summary,
      p_next_step: input.nextStep,
      p_next_type: input.nextActionType,
      p_next_date: input.nextActionDate,
    });
    if (error) {
      console.error("SALES_ACTIVITY_WRITE_FAILED", { code: error.code });
      const errors: Record<string, [string, number]> = {
        "42501": ["אין הרשאה לשמור את הפעילות.", 403],
        "P0002": ["ליד לא נמצא.", 404],
        "22023": ["נדרש מועד עתידי תקין. בליד סגור ניתן לשמור תיעוד בלבד.", 400],
        "23505": ["בקשת השמירה כבר שימשה לפעילות אחרת. יש לפתוח מחדש את החלונית.", 409],
      };
      const [message, status] = errors[error.code] ?? ["השמירה לא אושרה. ניתן לנסות שוב בבטחה באותה חלונית.", 503];
      return failure(message, status);
    }
    for (const path of ["/dashboard", "/leads", "/pipeline", "/business-center", "/business-center/insights"]) revalidatePath(path);
    return NextResponse.json({ activity: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure("השמירה לא אושרה. ניתן לנסות שוב בבטחה באותה חלונית.", 503);
  }
}
