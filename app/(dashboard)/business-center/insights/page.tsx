import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessInsights } from "@/components/business-center/business-insights";
import {
  resolveBusinessInsightsSelection,
  type BusinessInsightsSearchParams,
} from "@/lib/business-center/insights";
import { getBusinessInsightsData } from "@/lib/business-center/insights-server";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "סיכומים ומגמות | GoldenFlow CRM",
};

export default async function BusinessInsightsPage({
  searchParams,
}: {
  searchParams: Promise<BusinessInsightsSearchParams>;
}) {
  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const selection = resolveBusinessInsightsSelection(
    await searchParams,
    now,
  );
  const data = await getBusinessInsightsData(
    supabase,
    user.id,
    selection,
    now,
  );

  return <BusinessInsights summary={data.summary} trends={data.trends} />;
}
