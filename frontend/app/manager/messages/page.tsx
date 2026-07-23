import { redirect } from "next/navigation";

export default function LegacyManagerMessagesRoute() {
  redirect("/dashboard/manager/messages");
}
