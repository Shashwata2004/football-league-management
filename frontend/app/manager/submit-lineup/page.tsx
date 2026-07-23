import { redirect } from "next/navigation";

export default function LegacyManagerLineupRoute() {
  redirect("/dashboard/manager/submit-lineup");
}
