import { redirect } from "next/navigation";

export default function LegacyManagerProfileRoute() {
  redirect("/dashboard/manager/profile");
}
