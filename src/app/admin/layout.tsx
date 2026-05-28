import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminShell from "@/components/secretza/admin/routes/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "admin") {
    redirect("/");
  }

  return <AdminShell>{children}</AdminShell>;
}
