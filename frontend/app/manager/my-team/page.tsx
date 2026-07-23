import { redirect } from "next/navigation";

export default function LegacyManagerTeamRoute() {
  redirect("/dashboard/manager/my-team");
}
