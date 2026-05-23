"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export function DashboardActionBar() {
  return (
    <div className="relative z-40 w-full max-w-full overflow-x-clip border-b border-gold/20 bg-black/85 px-3 py-3 shadow-[0_10px_35px_rgba(201,162,39,0.10)] backdrop-blur-xl sm:px-4">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 rounded-2xl border border-gold/15 bg-white/[0.025] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_14px_38px_rgba(0,0,0,0.20)] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-xs font-bold uppercase tracking-[0.28em] text-gold-soft sm:text-right">
          פעולות מהירות
        </p>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
          <Link className="button-primary w-full gap-2 px-5 sm:w-auto" href="/leads">
            <Plus className="h-4 w-4" />
            ליד חדש
          </Link>
          <Link className="button-primary w-full gap-2 px-5 sm:w-auto" href="/tasks">
            <Plus className="h-4 w-4" />
            משימה
          </Link>
        </div>
      </div>
    </div>
  );
}
