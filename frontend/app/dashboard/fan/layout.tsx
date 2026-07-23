import type { ReactNode } from "react";
import FanDashboardShell from "./fan-dashboard-shell";

export default function FanDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <FanDashboardShell />
      {children}
    </>
  );
}
