"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, KanbanSquare, LayoutDashboard, ListTodo, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "מרכז השליטה", icon: LayoutDashboard },
  { href: "/leads", label: "לידים", icon: Users },
  { href: "/tasks", label: "המשימות שלי", icon: ListTodo },
  { href: "/pipeline", label: "מסלול המכירה", icon: KanbanSquare },
  { href: "/roi-center", label: "מרכז ROI", icon: BarChart3 },
] satisfies Array<{ href: Route; label: string; icon: LucideIcon }>;

type NavigationBadges = Partial<Record<"/leads" | "/tasks", number>>;

function NavLink({
  badge,
  href,
  icon: Icon,
  label,
}: {
  badge?: number;
  href: Route;
  icon: LucideIcon;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex min-h-12 items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-sm font-bold transition duration-200 active:scale-[0.98]",
        isActive
          ? "border-gold/70 bg-gold text-black shadow-[0_0_34px_rgba(201,162,39,0.28)]"
          : "border-white/[0.06] bg-white/[0.025] text-zinc-400 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-gold/10 hover:text-white hover:shadow-[0_0_26px_rgba(201,162,39,0.10)]",
      )}
      href={href}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition duration-200",
          isActive
            ? "border-black/10 bg-black/10 text-black"
            : "border-white/10 bg-black/25 text-zinc-500 group-hover:border-gold/30 group-hover:text-gold-soft",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">{label}</span>
      {typeof badge === "number" ? (
        <span
          className={cn(
            "min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-black",
            isActive ? "bg-black/15 text-black" : "border border-gold/20 bg-black/40 text-gold-soft",
          )}
        >
          {badge}
        </span>
      ) : null}
      {isActive ? <span className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-black/20" /> : null}
    </Link>
  );
}

export function NavigationLinks({ badges = {} }: { badges?: NavigationBadges }) {
  return (
    <nav className="space-y-3">
      {navigation.map((item) => (
        <NavLink badge={badges[item.href as keyof NavigationBadges]} key={item.href} {...item} />
      ))}
    </nav>
  );
}
