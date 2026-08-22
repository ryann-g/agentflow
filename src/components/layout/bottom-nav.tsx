"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOverdueCount } from "@/hooks/use-overdue-count";
import { LayoutDashboard, Users, UserPlus, Contact, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard, badge: "overdue" as const },
  { href: "/leads", label: "Leads", icon: Contact, badge: null },
  { href: "/pipeline", label: "Pipeline", icon: Users, badge: null },
  { href: "/leads/new", label: "Add Lead", icon: UserPlus, badge: null },
  { href: "/settings", label: "Settings", icon: Settings, badge: null },
];

export function BottomNav() {
  const pathname = usePathname();
  const overdueCount = useOverdueCount();

  

  function getBadgeCount(badge: "overdue" | null): number | null {
    if (badge === "overdue") return overdueCount > 0 ? overdueCount : null;
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-surface-200 safe-bottom z-40 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const badgeCount = getBadgeCount(item.badge);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 h-14 min-h-touch rounded-lg transition-colors relative",
                isActive
                  ? "text-primary"
                  : "text-surface-500 hover:text-surface-600"
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {badgeCount !== null && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-2 text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none",
                      item.badge === "overdue"
                        ? "bg-destructive text-white"
                        : "bg-primary-100 text-primary-700"
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
