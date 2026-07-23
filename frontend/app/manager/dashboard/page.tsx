import { redirect } from "next/navigation";

export default function LegacyManagerDashboardRoute() {
  redirect("/dashboard/manager");
}
