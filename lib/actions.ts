"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { requireSubscriptionAccess, SUBSCRIPTION_REQUIRED_MESSAGE } from "@/lib/subscription-guard";
import { createServerClient } from "@/lib/supabase/server";
import { normalizeTaskPriority, normalizeTaskStatus } from "@/lib/tasks";

type SupabaseError = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
};

type TaskPayload = {
  assigned_to?: string | null;
  description?: string | null;
  due_date?: string | null;
  linked_lead_id?: string | null;
  priority?: string | null;
  status?: string | null;
  title?: string | null;
};

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function getErrorMessage(error: SupabaseError) {
  return [error.message, error.details, error.hint, error.code ? `Code: ${error.code}` : ""].filter(Boolean).join(" ");
}

function getTaskSchemaErrorMessage(error: SupabaseError) {
  const message = getErrorMessage(error);

  if (error.code === "PGRST204") {
    return `${message} יש להריץ את מיגרציית Supabase: supabase/20260502_fix_tasks_missing_columns.sql`;
  }

  return message;
}

function sanitizeTaskPayload(payload: TaskPayload) {
  const title = String(payload.title || "").trim();

  if (!title) {
    return { error: "כותרת המשימה היא שדה חובה" };
  }

  const status = normalizeTaskStatus(payload.status);
  const completedAt = status === "הושלמה" ? new Date().toISOString() : null;

  return {
    task: {
      assigned_to: String(payload.assigned_to || "").trim() || null,
      completed_at: completedAt,
      description: String(payload.description || "").trim() || null,
      due_date: String(payload.due_date || "").trim() || null,
      linked_lead_id: String(payload.linked_lead_id || "").trim() || null,
      priority: normalizeTaskPriority(payload.priority),
      status,
      title,
    },
  };
}

function revalidateTaskPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

export async function getCurrentUser() {
  if (!hasSupabaseEnv()) {
    redirect(`/login?error=${encodeMessage("יש להגדיר Supabase לפני שימוש במערכת")}`);
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?error=${encodeMessage(error ? getErrorMessage(error) : "יש להתחבר מחדש")}`);
  }

  return { supabase, user };
}

export async function signIn(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect(`/login?error=${encodeMessage("חסרה הגדרת Supabase")}`);
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/login?error=${encodeMessage("יש למלא מייל וסיסמה")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeMessage(getErrorMessage(error))}`);
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect(`/login?error=${encodeMessage("חסרה הגדרת Supabase")}`);
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const firstName = String(formData.get("first_name") || formData.get("name") || "").trim();

  if (firstName.length < 2 || !email || password.length < 6) {
    redirect(`/login?error=${encodeMessage("יש להזין שם פרטי, מייל וסיסמה באורך 6 תווים לפחות")}`);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
      },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeMessage(getErrorMessage(error))}`);
  }

  if (data.user?.id) {
    await supabase.from("users").upsert({ first_name: firstName, id: data.user.id }, { onConflict: "id" });
  }

  if (!data.session) {
    redirect(`/login?success=${encodeMessage("החשבון נוצר. בדקו את המייל לאישור ההרשמה")}`);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getUsers() {
  const { supabase, user } = await getCurrentUser();
  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { data: [], error: SUBSCRIPTION_REQUIRED_MESSAGE };
  }

  const { data, error } = await supabase.from("users").select("id, first_name").order("first_name", { ascending: true });

  if (error) {
    return {
      data: [
        {
          email: user.email ?? null,
          first_name: String(user.user_metadata?.first_name || "").trim() || null,
          id: user.id,
        },
      ],
      error: getErrorMessage(error),
    };
  }

  const rows = data?.length
    ? data.map((row) => ({
        email: row.id === user.id ? user.email ?? null : null,
        first_name: row.first_name,
        id: row.id,
      }))
    : [
        {
          email: user.email ?? null,
          first_name: String(user.user_metadata?.first_name || "").trim() || null,
          id: user.id,
        },
      ];

  return { data: rows, error: null };
}

export async function createTask(formData: FormData) {
  const result = await createCrmTask({
    assigned_to: String(formData.get("assigned_to") || ""),
    description: String(formData.get("description") || ""),
    due_date: String(formData.get("due_date") || ""),
    linked_lead_id: String(formData.get("linked_lead_id") || ""),
    priority: String(formData.get("priority") || "בינונית"),
    status: String(formData.get("status") || "פתוחה"),
    title: String(formData.get("title") || ""),
  });

  if (result.error) {
    redirect(`/tasks?error=${encodeMessage(result.error)}`);
  }

  redirect(`/tasks?success=${encodeMessage("המשימה נשמרה")}`);
}

export async function createCrmTask(payload: TaskPayload) {
  const { supabase, user } = await getCurrentUser();
  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { error: subscription.error };
  }

  const normalized = sanitizeTaskPayload(payload);

  if ("error" in normalized) {
    return { error: normalized.error };
  }

  const task = normalized.task;
  const insertPayload = {
    assigned_to: task.assigned_to || user.id,
    description: task.description,
    due_date: task.due_date,
    linked_lead_id: task.linked_lead_id,
    priority: task.priority || "בינונית",
    status: task.status || "פתוחה",
    title: task.title,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from("tasks")
    .insert(insertPayload)
    .select("id, user_id, assigned_to, title, description, status, priority, due_date, linked_lead_id, is_automated, created_at, updated_at, completed_at, deleted_at")
    .single();

  if (error) {
    return { error: getTaskSchemaErrorMessage(error) };
  }

  revalidateTaskPaths();
  return { data, success: "המשימה נשמרה" };
}

export async function updateTask(taskId: string, payload: TaskPayload) {
  const { supabase, user } = await getCurrentUser();
  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { error: subscription.error };
  }

  const normalized = sanitizeTaskPayload(payload);

  if (!taskId) {
    return { error: "מזהה משימה חסר" };
  }

  if ("error" in normalized) {
    return { error: normalized.error };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...normalized.task,
      assigned_to: normalized.task.assigned_to || user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
    .is("deleted_at", null)
    .select("id, user_id, assigned_to, title, description, status, priority, due_date, linked_lead_id, is_automated, created_at, updated_at, completed_at, deleted_at")
    .single();

  if (error) {
    return { error: getErrorMessage(error) };
  }

  revalidateTaskPaths();
  return { data, success: "המשימה עודכנה" };
}

export async function toggleTask(taskId: string, complete: boolean) {
  const result = complete ? await completeTask(taskId) : await reopenTask(taskId);

  if (result.error) {
    redirect(`/tasks?error=${encodeMessage(result.error)}`);
  }

  redirect(`/tasks?success=${encodeMessage("המשימה עודכנה")}`);
}

export async function completeTask(taskId: string) {
  const { supabase, user } = await getCurrentUser();
  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { error: subscription.error };
  }

  const now = new Date().toISOString();

  if (!taskId) {
    return { error: "מזהה משימה חסר" };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ completed_at: now, status: "הושלמה", updated_at: now })
    .eq("id", taskId)
    .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
    .is("deleted_at", null)
    .select("id, user_id, assigned_to, title, description, status, priority, due_date, linked_lead_id, is_automated, created_at, updated_at, completed_at, deleted_at")
    .single();

  if (error) {
    return { error: getErrorMessage(error) };
  }

  revalidateTaskPaths();
  return { data, success: "המשימה הושלמה" };
}

export async function reopenTask(taskId: string) {
  const { supabase, user } = await getCurrentUser();
  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { error: subscription.error };
  }

  if (!taskId) {
    return { error: "מזהה משימה חסר" };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ completed_at: null, status: "פתוחה", updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
    .is("deleted_at", null)
    .select("id, user_id, assigned_to, title, description, status, priority, due_date, linked_lead_id, is_automated, created_at, updated_at, completed_at, deleted_at")
    .single();

  if (error) {
    return { error: getErrorMessage(error) };
  }

  revalidateTaskPaths();
  return { data, success: "המשימה נפתחה מחדש" };
}

export async function postponeTask(taskId: string) {
  const { supabase, user } = await getCurrentUser();
  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { error: subscription.error };
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (!taskId) {
    return { error: "מזהה משימה חסר" };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      due_date: tomorrow.toISOString().slice(0, 10),
      status: "נדחתה",
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
    .is("deleted_at", null)
    .select("id, user_id, assigned_to, title, description, status, priority, due_date, linked_lead_id, is_automated, created_at, updated_at, completed_at, deleted_at")
    .single();

  if (error) {
    return { error: getErrorMessage(error) };
  }

  revalidateTaskPaths();
  return { data, success: "המשימה נדחתה למחר" };
}

export async function deleteTask(taskId: string) {
  return softDeleteTask(taskId);
}

export async function softDeleteTask(taskId: string) {
  const { supabase, user } = await getCurrentUser();
  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { error: subscription.error };
  }

  const now = new Date().toISOString();

  if (!taskId) {
    return { error: "מזהה משימה חסר" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", taskId)
    .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);

  if (error) {
    return { error: getErrorMessage(error) || "❌ שגיאה במחיקה, נסה שוב" };
  }

  revalidateTaskPaths();
  return { success: "המשימה נמחקה" };
}
