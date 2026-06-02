"use client";

import { usePathname } from "next/navigation";
import AdminPageRenderer from "@/components/secretza/admin/AdminPageRenderer";

export default function AdminCatchAllPage() {
  const pathname = usePathname();
  return <AdminPageRenderer pathname={pathname} />;
}
