import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell";

// Admin pages are static shells; every read and write happens in the browser
// with the admin's own session, checked by Postgres. Never indexed.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | KITTORA Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
