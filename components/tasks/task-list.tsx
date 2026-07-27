"use client";

import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Link2,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { completeTask, createCrmTask, postponeTask, reopenTask, softDeleteTask, updateTask } from "@/lib/actions";
import { normalizeTaskPriority, normalizeTaskStatus, TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/tasks";

type Task = {
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
  deleted_at: string | null;
  description: string | null;
  due_date: string | null;
  id: string;
  is_automated?: boolean | null;
  linked_lead_id: string | null;
  priority: string | null;
  status: string;
  title: string;
  updated_at: string;
};

type LeadOption = {
  id: string;
  name: string;
  phone: string | null;
  value: number | null;
};

type UserOption = {
  email: string | null;
  first_name: string | null;
  id: string;
};

type TaskFormState = {
  assigned_to: string;
  description: string;
  due_date: string;
  linked_lead_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
};

type TabKey = "my" | "team" | "overdue" | "today" | "completed";
type DateFilter = "all" | "overdue" | "today" | "week" | "none";

const EMPTY_FORM: TaskFormState = {
  assigned_to: "",
  description: "",
  due_date: "",
  linked_lead_id: "",
  priority: "בינונית",
  status: "פתוחה",
  title: "",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function taskDueDate(task: Pick<Task, "due_date">) {
  return dateInputValue(task.due_date);
}

function formatDate(value: string | null) {
  if (!value) {
    return "ללא תאריך";
  }

  return new Date(value).toLocaleDateString("he-IL", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0, style: "currency", currency: "ILS" }).format(value || 0);
}

function isCompleted(task: Task) {
  return normalizeTaskStatus(task.status) === "הושלמה";
}

function isOverdue(task: Task) {
  return Boolean(taskDueDate(task) && taskDueDate(task) < todayIso() && !isCompleted(task));
}

function isDueToday(task: Task) {
  return Boolean(taskDueDate(task) === todayIso() && !isCompleted(task));
}

function isDueThisWeek(task: Task) {
  const dueDate = taskDueDate(task);
  return Boolean(dueDate && dueDate >= todayIso() && dueDate <= addDaysIso(7) && !isCompleted(task));
}

function isCompletedThisWeek(task: Task) {
  if (!task.completed_at) {
    return false;
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  return new Date(task.completed_at) >= weekStart;
}

function priorityClass(priority: string | null) {
  const normalized = normalizeTaskPriority(priority);

  if (normalized === "דחוף") {
    return "border-danger/35 bg-danger/10 text-red-100 shadow-[0_0_18px_rgba(229,72,77,0.16)]";
  }

  if (normalized === "גבוהה") {
    return "border-gold/35 bg-gold/10 text-gold-soft";
  }

  if (normalized === "נמוכה") {
    return "border-white/10 bg-white/5 text-zinc-300";
  }

  return "border-gold/20 bg-card text-zinc-100";
}

function statusClass(status: string) {
  const normalized = normalizeTaskStatus(status);

  if (normalized === "הושלמה") {
    return "border-success/30 bg-success/10 text-green-100";
  }

  if (normalized === "בתהליך") {
    return "border-process/30 bg-process/10 text-blue-100";
  }

  if (normalized === "נדחתה") {
    return "border-gold/30 bg-gold/10 text-gold-soft";
  }

  return "border-white/10 bg-white/5 text-zinc-200";
}

function taskToForm(task: Task): TaskFormState {
  return {
    assigned_to: task.assigned_to || "",
    description: task.description || "",
    due_date: dateInputValue(task.due_date),
    linked_lead_id: task.linked_lead_id || "",
    priority: normalizeTaskPriority(task.priority),
    status: normalizeTaskStatus(task.status),
    title: task.title,
  };
}

function assigneeName(user: UserOption | undefined | null) {
  return user?.first_name || user?.email || "לא משויך";
}

export function TaskList({
  assignees = [],
  currentUserId,
  leads = [],
  tasks = [],
}: {
  assignees?: UserOption[] | null;
  currentUserId: string;
  leads?: LeadOption[] | null;
  tasks?: Task[] | null;
}) {
  const router = useRouter();
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks ?? []);
  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [form, setForm] = useState<TaskFormState>({ ...EMPTY_FORM, assigned_to: currentUserId });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeActionId, setActiveActionId] = useState("");
  const [isPending, startTransition] = useTransition();
  const taskDialogRef = useDialogAccessibility(
    isModalOpen,
    closeModal,
    activeActionId === "save" || isPending,
  );
  const deleteDialogRef = useDialogAccessibility(
    Boolean(taskToDelete),
    () => setTaskToDelete(null),
    Boolean(taskToDelete && activeActionId === `delete:${taskToDelete.id}`) || isPending,
  );

  useEffect(() => {
    setLocalTasks(tasks ?? []);
  }, [tasks]);

  const leadsById = useMemo(() => new Map((leads ?? []).map((lead) => [lead.id, lead])), [leads]);
  const assigneesById = useMemo(() => new Map((assignees ?? []).map((assignee) => [assignee.id, assignee])), [assignees]);

  const metrics = useMemo(() => {
    const activeTasks = localTasks.filter((task) => !task.deleted_at);
    const myTasks = activeTasks.filter((task) => task.assigned_to === currentUserId);

    return {
      completedWeek: activeTasks.filter(isCompletedThisWeek).length,
      myCompletedWeek: myTasks.filter(isCompletedThisWeek).length,
      myOpen: myTasks.filter((task) => !isCompleted(task)).length,
      myOverdue: myTasks.filter(isOverdue).length,
      overdue: activeTasks.filter(isOverdue).length,
      today: activeTasks.filter(isDueToday).length,
      urgent: activeTasks.filter((task) => normalizeTaskPriority(task.priority) === "דחוף" && !isCompleted(task)).length,
    };
  }, [currentUserId, localTasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return localTasks
      .filter((task) => !task.deleted_at)
      .filter((task) => {
        if (activeTab === "my") {
          return task.assigned_to === currentUserId && !isCompleted(task);
        }

        if (activeTab === "team") {
          return !isCompleted(task);
        }

        if (activeTab === "overdue") {
          return isOverdue(task);
        }

        if (activeTab === "today") {
          return isDueToday(task);
        }

        return isCompleted(task);
      })
      .filter((task) => (statusFilter === "all" ? true : normalizeTaskStatus(task.status) === statusFilter))
      .filter((task) => (priorityFilter === "all" ? true : normalizeTaskPriority(task.priority) === priorityFilter))
      .filter((task) => (leadFilter === "all" ? true : task.linked_lead_id === leadFilter))
      .filter((task) => {
        if (dateFilter === "overdue") {
          return isOverdue(task);
        }

        if (dateFilter === "today") {
          return isDueToday(task);
        }

        if (dateFilter === "week") {
          return isDueThisWeek(task);
        }

        if (dateFilter === "none") {
          return !task.due_date;
        }

        return true;
      })
      .filter((task) => {
        if (!normalizedSearch) {
          return true;
        }

        const linkedLead = task.linked_lead_id ? leadsById.get(task.linked_lead_id) : null;
        const assignedUser = task.assigned_to ? assigneesById.get(task.assigned_to) : null;
        return [task.title, task.description, linkedLead?.name, assignedUser?.first_name, assignedUser?.email].some((value) =>
          value?.toLowerCase().includes(normalizedSearch),
        );
      })
      .sort((a, b) => {
        const priorityWeight: Record<TaskPriority, number> = { דחוף: 4, גבוהה: 3, בינונית: 2, נמוכה: 1 };

        return (
          Number(isOverdue(b)) - Number(isOverdue(a)) ||
          Number(isDueToday(b)) - Number(isDueToday(a)) ||
          priorityWeight[normalizeTaskPriority(b.priority)] - priorityWeight[normalizeTaskPriority(a.priority)] ||
          (taskDueDate(a) || "9999-12-31").localeCompare(taskDueDate(b) || "9999-12-31")
        );
      });
  }, [activeTab, assigneesById, currentUserId, dateFilter, leadFilter, leadsById, localTasks, priorityFilter, searchTerm, statusFilter]);

  function openCreateModal() {
    setEditingTask(null);
    setForm({ ...EMPTY_FORM, assigned_to: currentUserId });
    setIsModalOpen(true);
  }

  function openEditModal(task: Task) {
    setEditingTask(task);
    setForm(taskToForm(task));
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingTask(null);
    setForm({ ...EMPTY_FORM, assigned_to: currentUserId });
  }

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  }

  function submitTask() {
    const payload = {
      assigned_to: form.assigned_to || currentUserId,
      description: form.description,
      due_date: form.due_date || null,
      linked_lead_id: form.linked_lead_id || null,
      priority: form.priority,
      status: form.status,
      title: form.title,
    };

    if (form.title.trim().length < 1) {
      showToast("error", "כותרת המשימה היא שדה חובה");
      return;
    }

    setActiveActionId("save");
    startTransition(async () => {
      const result = editingTask ? await updateTask(editingTask.id, payload) : await createCrmTask(payload);

      if (result?.error) {
        showToast("error", editingTask ? result.error : `❌ לא ניתן ליצור משימה – בדוק את ההגדרות ${result.error}`);
        setActiveActionId("");
        return;
      }

      if (result?.data) {
        setLocalTasks((current) =>
          editingTask ? current.map((task) => (task.id === editingTask.id ? (result.data as Task) : task)) : [result.data as Task, ...current],
        );
      }

      closeModal();
      showToast("success", editingTask ? "✔ המשימה עודכנה" : "✔ המשימה נוצרה");
      setActiveActionId("");
      router.refresh();
    });
  }

  function runTaskAction(taskId: string, action: "complete" | "reopen" | "postpone") {
    setActiveActionId(`${action}:${taskId}`);
    startTransition(async () => {
      const result =
        action === "complete" ? await completeTask(taskId) : action === "reopen" ? await reopenTask(taskId) : await postponeTask(taskId);

      if (result?.error) {
        showToast("error", result.error);
        setActiveActionId("");
        return;
      }

      if (result?.data) {
        setLocalTasks((current) => current.map((task) => (task.id === taskId ? (result.data as Task) : task)));
      }

      showToast(
        "success",
        action === "complete" ? "✔ המשימה סומנה כהושלמה" : action === "reopen" ? "✔ המשימה נפתחה מחדש" : "✔ המשימה נדחתה למחר",
      );
      setActiveActionId("");
      router.refresh();
    });
  }

  function confirmDeleteTask() {
    if (!taskToDelete) {
      return;
    }

    const taskId = taskToDelete.id;
    setActiveActionId(`delete:${taskId}`);
    startTransition(async () => {
      const result = await softDeleteTask(taskId);

      if (result?.error) {
        showToast("error", result.error || "❌ שגיאה במחיקה, נסה שוב");
        setActiveActionId("");
        return;
      }

      setLocalTasks((current) => current.filter((task) => task.id !== taskId));
      setTaskToDelete(null);
      showToast("success", "✔ המשימה נמחקה");
      setActiveActionId("");
      router.refresh();
    });
  }

  const tabs: Array<{ count: number; icon: typeof UserCheck; key: TabKey; label: string }> = [
    { count: metrics.myOpen, icon: UserCheck, key: "my", label: "המשימות שלי" },
    { count: localTasks.filter((task) => !task.deleted_at && !isCompleted(task)).length, icon: Users, key: "team", label: "משימות צוות" },
    { count: metrics.overdue, icon: AlertTriangle, key: "overdue", label: "באיחור" },
    { count: metrics.today, icon: CalendarDays, key: "today", label: "להיום" },
    { count: localTasks.filter((task) => !task.deleted_at && isCompleted(task)).length, icon: CheckCircle2, key: "completed", label: "הושלמו" },
  ];

  const hasNotifications = metrics.overdue > 0 || metrics.today > 0 || metrics.urgent > 0;

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className={`fixed left-4 top-20 z-[70] rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl ${
            toast.type === "success" ? "border-success/30 bg-success/15 text-green-100" : "border-danger/35 bg-danger/15 text-red-100"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="card-money p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-gold-soft">
                <Bell className="h-5 w-5" />
                <h2 className="text-xl font-black text-white">התראות משימות</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">מה דורש תשומת לב עכשיו כדי שהיום לא יברח.</p>
            </div>
            {!hasNotifications ? <span className="rounded-full border border-success/25 bg-success/10 px-4 py-2 text-sm text-green-100">אין התראות כרגע</span> : null}
          </div>

          {hasNotifications ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-danger/25 bg-danger/10 p-4">
                <p className="text-sm text-red-100">משימות באיחור</p>
                <strong className="mt-2 block text-3xl font-black text-white">{metrics.overdue}</strong>
              </div>
              <div className="rounded-2xl border border-gold/25 bg-gold/10 p-4">
                <p className="text-sm text-gold-soft">משימות להיום</p>
                <strong className="mt-2 block text-3xl font-black text-white">{metrics.today}</strong>
              </div>
              <div className="rounded-2xl border border-danger/25 bg-danger/10 p-4">
                <p className="text-sm text-red-100">משימות דחופות</p>
                <strong className="mt-2 block text-3xl font-black text-white">{metrics.urgent}</strong>
              </div>
            </div>
          ) : null}
        </article>

        <article className="card-default p-6">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-gold-soft" />
            <h2 className="text-xl font-black text-white">העומס שלי</h2>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="text-sm text-zinc-400">פתוחות שלי</span>
              <strong className="text-2xl font-black text-white">{metrics.myOpen}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3">
              <span className="text-sm text-red-100">באיחור</span>
              <strong className="text-2xl font-black text-white">{metrics.myOverdue}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-success/20 bg-success/10 px-4 py-3">
              <span className="text-sm text-green-100">הושלמו השבוע</span>
              <strong className="text-2xl font-black text-white">{metrics.myCompletedWeek}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: CalendarDays, label: "משימות להיום", tone: "card-money", value: metrics.today },
          { icon: Clock3, label: "משימות באיחור", tone: "card-danger", value: metrics.overdue },
          { icon: CheckCircle2, label: "דחופות", tone: "card-default", value: metrics.urgent },
          { icon: CheckCircle2, label: "הושלמו השבוע", tone: "card-success", value: metrics.completedWeek },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article className={`${item.tone} flex min-h-[150px] flex-col justify-between p-6 transition duration-200 hover:-translate-y-1`} key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-zinc-300">{item.label}</p>
                <Icon className="h-5 w-5 text-gold-soft/85" />
              </div>
              <strong className="mt-5 block text-4xl font-black leading-none text-white">{item.value}</strong>
              <p className="mt-3 text-xs text-zinc-500">מסודר לפי דחיפות ותאריך יעד</p>
            </article>
          );
        })}
      </section>

      <section className="panel p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">מרכז משימות מכירה</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">פולואפים, שיחות ותזכורות שמחוברות ללידים ולעבודה היומית.</p>
          </div>
          <button className="button-primary w-full gap-2 xl:w-auto" onClick={openCreateModal} type="button">
            <Plus className="h-4 w-4" />
            + משימה חדשה
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,0.7fr))]">
          <label className="field flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="חיפוש לפי כותרת, תיאור או ליד"
              value={searchTerm}
            />
          </label>

          <select className="field" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="all">כל הסטטוסים</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select className="field" onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
            <option value="all">כל העדיפויות</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>

          <select className="field" onChange={(event) => setDateFilter(event.target.value as DateFilter)} value={dateFilter}>
            <option value="all">כל התאריכים</option>
            <option value="overdue">באיחור</option>
            <option value="today">להיום</option>
            <option value="week">השבוע</option>
            <option value="none">ללא תאריך</option>
          </select>

          <select className="field" onChange={(event) => setLeadFilter(event.target.value)} value={leadFilter}>
            <option value="all">כל הלידים</option>
            {(leads ?? []).map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold transition duration-200 active:scale-[0.98] ${
                  activeTab === tab.key
                    ? "border-gold/45 bg-gold text-black shadow-[0_0_28px_rgba(201,162,39,0.28)]"
                    : "border-white/10 bg-card text-zinc-200 hover:-translate-y-0.5 hover:border-gold/25 hover:bg-white/[0.06]"
                }`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                <span className="flex items-center justify-center gap-2">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">{tab.count}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4">
        {!filteredTasks.length ? (
          <div className="panel flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-2xl">✓</div>
            <h3 className="mt-4 text-xl font-bold text-white">אין משימות בתצוגה הזו</h3>
            <p className="mt-2 max-w-md text-sm leading-7 text-zinc-400">אפשר לשנות סינון או ליצור משימה חדשה כדי לשמור את העבודה היומית מסודרת.</p>
            <button className="button-primary mt-5" onClick={openCreateModal} type="button">
              + משימה חדשה
            </button>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const linkedLead = task.linked_lead_id ? leadsById.get(task.linked_lead_id) : null;
            const assignedUser = task.assigned_to ? assigneesById.get(task.assigned_to) : null;
            const assignedLabel = assigneeName(assignedUser);
            const completed = isCompleted(task);
            const overdue = isOverdue(task);
            const actionLoading = activeActionId.endsWith(`:${task.id}`) || isPending;

            return (
              <article
                className={`card-default p-5 transition duration-200 hover:-translate-y-1 ${
                  overdue ? "border-danger/30 shadow-[0_0_30px_rgba(229,72,77,0.18)]" : ""
                } ${completed ? "border-success/25 bg-success/10" : ""}`}
                key={task.id}
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(task.status)}`}>
                        {normalizeTaskStatus(task.status)}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityClass(task.priority)}`}>
                        {normalizeTaskPriority(task.priority)}
                      </span>
                      {overdue ? <span className="rounded-full border border-danger/35 bg-danger/10 px-3 py-1 text-xs font-semibold text-red-100">באיחור</span> : null}
                      {task.is_automated ? (
                        <span className="rounded-full border border-process/30 bg-process/10 px-3 py-1 text-xs font-semibold text-blue-100">
                          🤖 אוטומטי
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-4 text-2xl font-black text-white">{task.title}</h3>
                    {task.description ? <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-300">{task.description}</p> : null}

                    <div className="mt-4 grid gap-3 text-sm text-zinc-400 md:grid-cols-4">
                      <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        תאריך יעד: <strong className="text-zinc-100">{formatDate(task.due_date)}</strong>
                      </span>
                      <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        סטטוס: <strong className="text-zinc-100">{normalizeTaskStatus(task.status)}</strong>
                      </span>
                      <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        עדיפות: <strong className="text-zinc-100">{normalizeTaskPriority(task.priority)}</strong>
                      </span>
                      <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        👤 אחראי: <strong className="text-zinc-100">{assignedLabel}</strong>
                      </span>
                    </div>

                    {linkedLead ? (
                      <div className="mt-4 rounded-[22px] border border-gold/15 bg-gold/[0.06] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-gold-soft/70">ליד משויך</p>
                            <p className="mt-1 font-bold text-white">
                              {linkedLead.name} · {linkedLead.phone || "אין טלפון"} · {formatMoney(linkedLead.value)}
                            </p>
                          </div>
                          <button className="button-secondary gap-2" onClick={() => router.push(`/leads?lead=${linkedLead.id}`)} type="button">
                            <Link2 className="h-4 w-4" />
                            פתח ליד
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-64 xl:grid-cols-1">
                    {completed ? (
                      <button className="button-secondary" disabled={actionLoading} onClick={() => runTaskAction(task.id, "reopen")} type="button">
                        פתח מחדש
                      </button>
                    ) : (
                      <button className="button-primary" disabled={actionLoading} onClick={() => runTaskAction(task.id, "complete")} type="button">
                        סמן כהושלם
                      </button>
                    )}
                    <button className="button-secondary" disabled={actionLoading} onClick={() => runTaskAction(task.id, "postpone")} type="button">
                      דחה למחר
                    </button>
                    <button className="button-secondary gap-2" disabled={actionLoading} onClick={() => openEditModal(task)} type="button">
                      <Edit3 className="h-4 w-4" />
                      ערוך
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-danger/25 bg-card px-5 py-3 text-sm font-semibold text-red-100 transition duration-200 hover:-translate-y-0.5 hover:border-danger/45 hover:bg-danger/10 hover:shadow-[0_0_24px_rgba(229,72,77,0.14)] active:scale-[0.97]"
                      disabled={actionLoading}
                      onClick={() => setTaskToDelete(task)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      מחק משימה
                    </button>
                    {completed ? <p className="text-center text-xs text-gold-soft">✔ משימה בוצעה — ניתן למחוק אותה</p> : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm">
          <div
            aria-describedby="task-dialog-description"
            aria-labelledby="task-dialog-title"
            aria-modal="true"
            className="w-full max-w-2xl rounded-[28px] border border-gold/20 bg-zinc-950 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
            ref={taskDialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-white" id="task-dialog-title">{editingTask ? "עריכת משימה" : "משימה חדשה"}</h3>
                <p className="mt-2 text-sm text-zinc-400" id="task-dialog-description">חבר את המשימה לליד, קבע עדיפות ותאריך יעד, ושמור את המכירה בתנועה.</p>
              </div>
              <button aria-label="סגירת חלון המשימה" className="button-secondary px-4" onClick={closeModal} type="button">
                סגור
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-zinc-300 md:col-span-2">
                כותרת משימה
                <input
                  className="field mt-2"
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="לדוגמה: להתקשר לרון אחרי ההצעה"
                  required
                  value={form.title}
                />
              </label>

              <label className="block text-sm text-zinc-300 md:col-span-2">
                תיאור
                <textarea
                  className="field mt-2 min-h-28 resize-none"
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="מה צריך לעשות כדי לקדם את העסקה?"
                  value={form.description}
                />
              </label>

              <label className="block text-sm text-zinc-300">
                תאריך יעד
                <input
                  className="field mt-2"
                  onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                  type="date"
                  value={form.due_date}
                />
              </label>

              <label className="block text-sm text-zinc-300">
                עדיפות
                <select
                  className="field mt-2"
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
                  value={form.priority}
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-zinc-300">
                סטטוס
                <select
                  className="field mt-2"
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))}
                  value={form.status}
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-zinc-300">
                שיוך לליד
                <select
                  className="field mt-2"
                  onChange={(event) => setForm((current) => ({ ...current, linked_lead_id: event.target.value }))}
                  value={form.linked_lead_id}
                >
                  <option value="">ללא ליד משויך</option>
                  {(leads ?? []).map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-zinc-300 md:col-span-2">
                שיוך משימה
                <select
                  className="field mt-2"
                  onChange={(event) => setForm((current) => ({ ...current, assigned_to: event.target.value }))}
                  value={form.assigned_to || currentUserId}
                >
                  {(assignees?.length ? assignees : [{ email: null, first_name: "אני", id: currentUserId }]).map((assignee) => {
                    const label = assignee.first_name || assignee.email || "משתמש";
                    return (
                      <option key={assignee.id} value={assignee.id}>
                        👤 {label}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button className="button-primary" disabled={activeActionId === "save" || isPending} onClick={submitTask} type="button">
                {editingTask ? "שמור שינויים" : "שמור משימה"}
              </button>
              <button className="button-secondary" disabled={activeActionId === "save" || isPending} onClick={closeModal} type="button">
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {taskToDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm">
          <div
            aria-describedby="delete-task-description"
            aria-labelledby="delete-task-title"
            aria-modal="true"
            className="w-full max-w-md rounded-[28px] border border-danger/25 bg-zinc-950 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
            ref={deleteDialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <h3 className="text-2xl font-bold text-white" id="delete-task-title">האם למחוק את המשימה?</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300" id="delete-task-description">המשימה תוסר מהמערכת ולא תופיע ברשימת המשימות.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button className="button-danger" disabled={activeActionId === `delete:${taskToDelete.id}` || isPending} onClick={confirmDeleteTask} type="button">
                מחק משימה
              </button>
              <button
                aria-label="סגירת חלון מחיקת המשימה"
                className="button-secondary"
                disabled={activeActionId === `delete:${taskToDelete.id}` || isPending}
                onClick={() => setTaskToDelete(null)}
                type="button"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
