import { notFound } from "next/navigation";
import { isClosureQaRuntime } from "@/lib/account-closure/qa-guard.mjs";
import { calendarConfig } from "@/lib/calendar/server";

export const dynamic = "force-dynamic";

const STAGING_GOOGLE_CLIENT_ID = "1050151882712-f0072msci8l4m53gfq47lbvv48esfk81.apps.googleusercontent.com";
const QA_CALLBACK = "https://goldenflow-crm-git-codex-crm-de-73b8a9-ronhubi15-6252s-projects.vercel.app/api/calendar/callback";

export default function QaReadinessPage() {
  if (!isClosureQaRuntime(process.env)) notFound();

  const config = calendarConfig();
  const ready = Boolean(config
    && config.clientId === STAGING_GOOGLE_CLIENT_ID
    && config.redirectUri === QA_CALLBACK);

  return <main>QA Preview: {ready ? "READY" : "NOT_READY"}</main>;
}
