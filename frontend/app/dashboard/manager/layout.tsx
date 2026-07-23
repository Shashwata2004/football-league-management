import type { ReactNode } from "react";
import ManagerDashboardShell from "./manager-dashboard-shell";

export default function ManagerDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <ManagerDashboardShell />
      {children}
    </>
  );
}
