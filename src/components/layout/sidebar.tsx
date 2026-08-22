"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useOverdueCount } from "@/hooks/use-overdue-count";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Contact,
  Settings,
  Calendar,
  ExternalLink,
  Home,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard, badge: "overdue" as const },
  { href: "/leads", label: "Leads", icon: Contact, badge: null },
  { href: "/pipeline", label: "Pipeline", icon: Users, badge: null },
  { href: "/leads/new", label: "Add Lead", icon: UserPlus, badge: null },
];

export function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState("User");
  const [userPlan, setUserPlan] = useState("Free Plan");
  const overdueCount = useOverdueCount();
  const supabase = createClient();

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, plan")
          .eq("id", user.id)
          .single();
        if (profile) {
          setUserName(profile.full_name || "User");
          setUserPlan(profile.plan === "pro" ? "Pro Plan" : "Free Plan");
        }
      }
    }
    fetchProfile();
  }, [supabase]);

  

  function getBadgeCount(badge: "overdue" | null): number | null {
    if (badge === "overdue") return overdueCount > 0 ? overdueCount : null;
    return null;
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-surface border-r border-surface-200">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-surface-200">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Home className="h-4 w-4 text-white" />
          </div>
          <span className="font-heading text-lg font-bold text-surface-900">AgentFlow</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
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
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-touch relative",
                isActive
                  ? "bg-surface-100 text-surface-900"
                  : "text-surface-600 hover:bg-surface-50 hover:text-surface-900"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badgeCount !== null && (
                <span
                  className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                    item.badge === "overdue"
                      ? "bg-destructive text-white"
                      : "bg-primary-100 text-primary-700"
                  )}
                >
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Google Calendar Link */}
      <div className="px-3 pb-2">
        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-50 hover:text-surface-900 transition-colors min-h-touch"
        >
          <Calendar className="h-5 w-5 shrink-0" />
          <span className="flex-1">Google Calendar</span>
          <ExternalLink className="h-3.5 w-3.5 text-surface-500" />
        </a>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-surface-200">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-700 font-semibold text-sm">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-900 truncate">{userName}</p>
            <p className="text-xs text-surface-500 truncate">{userPlan}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
