import { DashboardActionBar } from "@/components/dashboard/dashboard-action-bar";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { TrialStatusCard } from "@/components/dashboard/trial-status-card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardActionBar />
      <TrialStatusCard />
      <DashboardMetrics />
    </div>
  );
}
