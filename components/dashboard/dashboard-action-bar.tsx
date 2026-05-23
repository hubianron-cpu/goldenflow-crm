"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export function DashboardActionBar() {
  return (
    <div className="sticky top-0 z-50 flex min-h-[64px] w-full max-w-full flex-col gap-3 overflow-x-clip border-b border-gold/25 bg-black/85 px-3 py-3 shadow-[0_10px_35px_rgba(201,162,39,0.12)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-start sm:gap-4 sm:px-4">
      <Link className="button-primary w-full gap-2 sm:w-auto" href="/leads">
        <Plus className="h-4 w-4" />
        ליד חדש
      </Link>
      <Link className="button-primary w-full gap-2 sm:w-auto" href="/tasks">
        <Plus className="h-4 w-4" />
        משימה
      </Link>
    </div>
  );
}
