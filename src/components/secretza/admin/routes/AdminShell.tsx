"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { CreditCard, FileText, LayoutDashboard, LogOut, Shield, Users } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/listings", label: "Listings", icon: FileText },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/users", label: "Users", icon: Users },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-[#F5F5F7] flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-[rgba(255,255,255,0.08)] bg-[#15151D]">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[rgba(255,255,255,0.08)]">
          <div className="size-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center">
            <Shield className="size-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">Secretza Admin</p>
            <p className="text-xs text-[#A1A1AA]">Management Console</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/25"
                    : "text-[#A1A1AA] border border-transparent hover:bg-white/[0.04] hover:text-[#F5F5F7]"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="m-3 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/20"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="lg:hidden sticky top-0 z-30 border-b border-[rgba(255,255,255,0.08)] bg-[#0B0B0F]/90 backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto p-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#A1A1AA]"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="whitespace-nowrap rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
