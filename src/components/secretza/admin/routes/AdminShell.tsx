"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Menu, X } from "lucide-react";
import Logo from "@/components/brand/Logo";
import { BRAND_NAME } from "@/lib/brand";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ADMIN_NAV_ITEMS, adminNavItemForPath } from "@/lib/admin-routes";

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = session?.user?.role;
  const isModerator = role === "moderator";

  const visibleNav = ADMIN_NAV_ITEMS.filter(
    (item) => !isModerator || item.moderatorAllowed !== false,
  );

  const current = adminNavItemForPath(pathname);

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-[#F5F5F7] flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[250px] bg-[#15151D] border-r border-[rgba(255,255,255,0.08)] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2">
            <Logo variant="icon" theme="dark" iconSize={32} />
            <div>
              <h1 className="text-sm font-bold text-[#F5F5F7]">Admin Panel</h1>
              <p className="text-[10px] text-[#A1A1AA]">{BRAND_NAME} Management</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded text-[#A1A1AA] hover:text-[#F5F5F7]"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {visibleNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/20"
                    : "text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.04)] border border-transparent"
                }`}
              >
                <Icon className="size-3.5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="m-3 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/20"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-[#0B0B0F]/80 backdrop-blur-xl border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)]"
              >
                <Menu className="size-5" />
              </button>
              <h1 className="text-lg font-semibold text-[#F5F5F7]">{current.label}</h1>
            </div>
            <Badge
              variant="outline"
              className="bg-[#7C3AED]/15 text-[#8B5CF6] border-[#7C3AED]/30 text-[10px] px-2 py-0.5 rounded-full"
            >
              {role === "admin" ? "Admin" : "Moderator"}
            </Badge>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
