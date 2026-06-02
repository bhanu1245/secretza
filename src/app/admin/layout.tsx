import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminShell from "@/components/secretza/admin/routes/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (role !== "admin" && role !== "moderator") {
    redirect("/");
  }

  return <AdminShell>{children}</AdminShell>;
}
