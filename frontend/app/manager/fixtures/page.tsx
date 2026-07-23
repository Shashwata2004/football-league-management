import { redirect } from "next/navigation";

export default function LegacyManagerFixturesRoute() {
  redirect("/dashboard/manager/fixtures");
}
