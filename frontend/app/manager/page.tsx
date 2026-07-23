import { redirect } from "next/navigation";

export default function LegacyManagerRoute() {
  redirect("/dashboard/manager");
}
